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

async function contextualizeBatch(supabase, document, batch) {
  const text = await callAI(supabase, {
    system: SYSTEM,
    prompt: buildPrompt(document, batch),
    json: true,
  })
  const parsed = parseJSON(text)
  const contexts = Array.isArray(parsed?.contexts) ? parsed.contexts : []
  // Never throw: a failed contextualizer degrades retrieval, it must not block indexing.
  return batch.map((_, i) => (typeof contexts[i] === 'string' ? contexts[i].trim() : ''))
}

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
