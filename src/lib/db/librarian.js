import { searchChunks } from './retrieval.js'
import { callAI } from '../ai.js'

// "Ask your library" — retrieval-augmented answers grounded in the user's own
// notes. This is the thing a big context window can't do: it pulls the handful
// of passages that actually matter and answers ONLY from them, with citations
// back to the source entries.
//
// The model never sees the whole library, only the retrieved passages, so the
// answer is bounded by what the user actually wrote — it can't confabulate a
// note that doesn't exist.

const MAX_PASSAGES = 8
const MAX_PASSAGE_CHARS = 700

const SYSTEM = `You are the user's librarian. You answer questions using ONLY the numbered passages from their personal notes provided below.

Rules:
- Ground every claim in the passages. Cite them inline like [1], [2].
- If the passages don't contain the answer, say so plainly — do NOT use outside knowledge to fill gaps. It is better to say "your notes don't cover this" than to guess.
- Be concise and direct. The user wrote these notes; don't lecture them, connect them.
- When passages conflict or a topic spans several notes, say so and cite each.`

// Build the passage block the model reads, and the citation list the UI renders.
export function buildContext(hits, titleByEntry) {
  const passages = hits.slice(0, MAX_PASSAGES)
  const lines = passages.map((h, i) => {
    const title = titleByEntry.get(h.entryId) || 'Untitled'
    const head = h.heading ? ` › ${h.heading}` : ''
    const body = h.content.length > MAX_PASSAGE_CHARS
      ? `${h.content.slice(0, MAX_PASSAGE_CHARS).trimEnd()}…`
      : h.content
    return `[${i + 1}] (${title}${head})\n${body}`
  })
  const sources = passages.map((h, i) => ({
    n: i + 1,
    entryId: h.entryId,
    title: titleByEntry.get(h.entryId) || 'Untitled',
    heading: h.heading || null,
    anchor: h.anchor || null,
  }))
  return { block: lines.join('\n\n'), sources }
}

/**
 * Answer a question from the user's library.
 * Returns { answer, sources[], usedContext } — usedContext:false means nothing
 * relevant was retrieved, so the UI can show "nothing in your notes" instead of
 * a hallucinated answer.
 */
export async function askLibrarian(supabase, question, { history = [] } = {}) {
  const q = String(question ?? '').trim()
  if (!q) return { answer: '', sources: [], usedContext: false }

  const hits = await searchChunks(supabase, { query: q, topK: MAX_PASSAGES })
  if (!hits.length) {
    return {
      answer: "I couldn't find anything in your notes about that. Try rephrasing, or it may be something you haven't captured yet.",
      sources: [],
      usedContext: false,
    }
  }

  const entryIds = [...new Set(hits.map((h) => h.entryId))]
  const { data: entries } = await supabase
    .from('entries')
    .select('id, title')
    .in('id', entryIds)
    .is('deleted_at', null)
  const titleByEntry = new Map((entries ?? []).map((e) => [e.id, e.title]))

  const { block, sources } = buildContext(hits, titleByEntry)

  // Keep the last few turns for follow-ups, but the passages are re-retrieved
  // every question so context always reflects the latest question, not the first.
  const messages = [
    { role: 'system', content: SYSTEM },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: `Passages from my notes:\n\n${block}\n\n---\nQuestion: ${q}` },
  ]

  const answer = await callAI(supabase, { messages })
  if (answer == null) {
    return {
      answer: 'The AI provider isn’t responding. Check that AI_BASE_URL / AI_API_KEY / AI_MODEL are set as Supabase secrets.',
      sources,
      usedContext: true,
      error: true,
    }
  }
  return { answer, sources, usedContext: true }
}
