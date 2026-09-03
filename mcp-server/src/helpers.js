export function normalizeName(value) {
  return String(value ?? '').trim()
}

export function normalizeLimit(value, fallback, max) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}

export function trimString(value, max) {
  return String(value ?? '').slice(0, max)
}

// How much of a note a list view is allowed to carry.
//
// Entries store up to 10,000 characters of note (clampNote), and a topic can
// hold hundreds. Returning them whole made list_entries_by_topic on a large
// topic emit ~7MB — roughly 1.8M tokens — which does not fail cleanly: it burns
// the caller's entire context and reads to the user as a rate limit. Lists
// carry a preview; `get_entry` returns the full text for one entry.
export const NOTE_PREVIEW_CHARS = 280

export function summarizeEntry(entry, { noteChars = NOTE_PREVIEW_CHARS } = {}) {
  if (!entry) return entry
  const note = typeof entry.note === 'string' ? entry.note : ''
  const truncated = note.length > noteChars
  return {
    id: entry.id,
    title: entry.title ?? null,
    url: entry.url ?? null,
    topic: entry.topicName ?? entry.topics?.name ?? null,
    due_at: entry.due_at ?? null,
    estimate_minutes: entry.estimate_minutes ?? null,
    status: entry.status ?? null,
    tags: entry.tags ?? [],
    updated_at: entry.updated_at ?? null,
    note_preview: truncated ? note.slice(0, noteChars) + '…' : note,
    // Stated so the caller knows to fetch the rest rather than assuming the
    // preview is the whole note.
    note_chars: note.length,
    note_truncated: truncated,
  }
}

export function summarizeEntries(entries, options) {
  return (entries || []).map((e) => summarizeEntry(e, options))
}
