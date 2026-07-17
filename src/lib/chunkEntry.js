import { chunkContent } from './chunkContent.js'
import { contextualizeChunks } from './contextualize.js'
import { NOTE_CHUNK_THRESHOLD, TASK_TYPE_DOCUMENT } from './chunkConfig.js'

const ALL_SOURCES = ['full_text', 'note', 'takeaway']

// Replaces embedEntryAsync. Fire-and-forget: indexing must never break a save.

// Stable non-cryptographic hash (FNV-1a) — only needs to detect "text changed".
export function hashText(text) {
  let h = 0x811c9dc5
  const s = String(text ?? '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

// Which of an entry's fields are chunkable, and how to split each.
// NOTE_CHUNK_THRESHOLD decides SPLITTING, never whether a note is indexed:
// every non-empty source is indexed, short ones simply produce one chunk.
export function sourcesFor(entry) {
  const out = []
  if (entry?.full_text?.trim()) {
    out.push({ source: 'full_text', text: entry.full_text, markdown: false })
  }
  if (entry?.note?.trim()) {
    out.push({
      source: 'note',
      text: entry.note,
      markdown: entry.note.length > NOTE_CHUNK_THRESHOLD,
    })
  }
  if (entry?.takeaway?.trim()) {
    out.push({ source: 'takeaway', text: entry.takeaway, markdown: true })
  }
  return out
}

async function embedAll(supabase, texts) {
  const { data, error } = await supabase.functions.invoke('embed-entry', {
    body: { texts, taskType: TASK_TYPE_DOCUMENT },
  })
  if (error || !Array.isArray(data?.embeddings)) return null
  return data.embeddings
}

async function chunkSource(supabase, entry, userId, { source, text, markdown }) {
  const source_hash = hashText(text)

  // Skip work entirely when this source's text is unchanged.
  const { data: existing } = await supabase
    .from('content_chunks')
    .select('source_hash')
    .eq('entry_id', entry.id)
    .eq('source', source)
    .limit(1)
  if (existing?.[0]?.source_hash === source_hash) return

  const chunks = chunkContent(text, { markdown })
  if (!chunks.length) return

  const contexts = await contextualizeChunks(supabase, { document: text, chunks })
  // Embed context + content together; `content` alone is what users see.
  const embeddings = await embedAll(
    supabase,
    chunks.map((c, i) => (contexts[i] ? `${contexts[i]}\n\n${c.content}` : c.content))
  )
  if (!embeddings) return

  const rows = chunks.map((c, i) => ({
    user_id: userId,
    entry_id: entry.id,
    source,
    position: c.position,
    heading: c.heading ?? null,
    anchor: c.anchor ?? null,
    char_start: c.charStart ?? null,
    content: c.content,
    context: contexts[i] || null,
    word_count: c.wordCount,
    source_hash,
    embedding: embeddings[i],
  }))

  await supabase.from('content_chunks').delete().eq('entry_id', entry.id).eq('source', source)
  await supabase.from('content_chunks').insert(rows)
}

export async function chunkEntryAsync(supabase, entry) {
  try {
    const sources = sourcesFor(entry)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Reconcile: drop chunks for any source this entry no longer has, so a
    // cleared note/takeaway/full_text stops appearing in search. Runs even when
    // the entry has no sources left (a fully-cleared entry deletes all its chunks).
    const keep = sources.map((s) => s.source)
    const drop = ALL_SOURCES.filter((s) => !keep.includes(s))
    if (drop.length) {
      await supabase.from('content_chunks').delete().eq('entry_id', entry.id).in('source', drop)
    }
    for (const s of sources) {
      await chunkSource(supabase, entry, user.id, s)
    }
  } catch {
    // Indexing is best-effort; a failure must never surface to the user.
  }
}
