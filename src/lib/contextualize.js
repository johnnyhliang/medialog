import { callAI, parseJSON } from './ai.js'
import { CONTEXTUALIZE_MIN_CHUNKS, CONTEXTUALIZE_BATCH_SIZE } from './chunkConfig.js'

// Contextual Retrieval (Anthropic): prepending chunk-specific situating context
// before embedding/indexing cuts retrieval failures ~35%, ~49% combined with a
// lexical arm. The `ai` passthrough has no prompt caching, so we BATCH — the
// document is sent once per group of chunks, not once per chunk.

const SYSTEM = 'You situate excerpts within their source document to improve search retrieval. Reply with JSON only.'

function buildPrompt(document, chunks) {
  const numbered = chunks
    .map((c, i) => `<chunk index="${i}">\n${c.content}\n</chunk>`)
    .join('\n')
  return `<document>
${document}
</document>

Here are ${chunks.length} chunk(s) from the document above:
${numbered}

For EACH chunk, give a short succinct context (1-2 sentences, under 100 tokens) situating it within the overall document, to improve search retrieval of that chunk. Do not repeat the chunk. Do not add commentary.

Reply with JSON only: {"contexts": ["context for chunk 0", "context for chunk 1", ...]} with exactly ${chunks.length} entries in order.`
}

async function askOnce(supabase, document, batch) {
  const text = await callAI(supabase, {
    system: SYSTEM,
    prompt: buildPrompt(document, batch),
    json: true,
  })
  const parsed = parseJSON(text)
  const contexts = Array.isArray(parsed?.contexts) ? parsed.contexts : []
  return batch.map((_, i) => (typeof contexts[i] === 'string' ? contexts[i].trim() : ''))
}

/**
 * One batch, with a split-and-retry on a short answer.
 *
 * A model asked for 32 contexts sometimes returns 20 and stops. The old code
 * padded the rest with '' — which is the pipeline's worst failure shape, because
 * a context-free chunk is INDISTINGUISHABLE from a good one: same dimensions, no
 * error, silently worse retrieval. That is exactly how 4,971 chunks were written
 * empty before anyone noticed (see docs/indexing-architecture.md).
 *
 * Halving and retrying costs one extra document re-send on the rare bad batch,
 * and is what makes a large batch size safe to use at all. Bounded by `depth` so
 * a model that always answers short degrades instead of recursing forever.
 */
async function contextualizeBatch(supabase, document, batch, depth = 0) {
  // Never throw: a failed contextualizer degrades retrieval, it must not block
  // indexing. An empty context is worse than a good one but far better than a
  // note that never gets saved.
  let out
  try {
    out = await askOnce(supabase, document, batch)
  } catch {
    out = batch.map(() => '')
  }

  const missing = out.filter((c) => !c).length
  if (missing === 0 || batch.length < 2 || depth >= MAX_SPLIT_DEPTH) return out

  const mid = Math.ceil(batch.length / 2)
  const [a, b] = await Promise.all([
    contextualizeBatch(supabase, document, batch.slice(0, mid), depth + 1),
    contextualizeBatch(supabase, document, batch.slice(mid), depth + 1),
  ])
  const retried = [...a, ...b]
  // Keep whichever answer filled more chunks — a retry that does worse than the
  // first attempt should not be allowed to throw away good contexts.
  return retried.filter(Boolean).length >= out.filter(Boolean).length ? retried : out
}

const MAX_SPLIT_DEPTH = 2 // 32 -> 16 -> 8, then accept whatever came back

export async function contextualizeChunks(supabase, { document, chunks }) {
  if (!chunks?.length) return []
  // A single chunk already IS its own context — contextualizing it is pure cost.
  if (chunks.length < CONTEXTUALIZE_MIN_CHUNKS) return chunks.map(() => '')

  const out = []
  for (let i = 0; i < chunks.length; i += CONTEXTUALIZE_BATCH_SIZE) {
    const batch = chunks.slice(i, i + CONTEXTUALIZE_BATCH_SIZE)
    out.push(...(await contextualizeBatch(supabase, document, batch)))
  }
  return out
}
