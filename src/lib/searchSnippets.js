const DEFAULT_RADIUS = 70

function cleanQuery(query) {
  return String(query || '').trim().toLowerCase()
}

function firstIndex(text, query) {
  if (!query) return -1
  return String(text || '').toLowerCase().indexOf(query)
}

export function entryMatchesLiteral(entry, query) {
  const q = cleanQuery(query)
  if (!q) return true
  return (
    firstIndex(entry.title, q) >= 0 ||
    firstIndex(entry.url, q) >= 0 ||
    firstIndex(entry.note, q) >= 0 ||
    (entry.tags || []).some((tag) => firstIndex(tag, q) >= 0)
  )
}

export function splitHighlightParts(text, query) {
  const source = String(text || '')
  const q = cleanQuery(query)
  if (!q) return [{ text: source, match: false }]

  const lower = source.toLowerCase()
  const parts = []
  let cursor = 0
  let idx = lower.indexOf(q)

  while (idx >= 0) {
    if (idx > cursor) parts.push({ text: source.slice(cursor, idx), match: false })
    parts.push({ text: source.slice(idx, idx + q.length), match: true })
    cursor = idx + q.length
    idx = lower.indexOf(q, cursor)
  }

  if (cursor < source.length) parts.push({ text: source.slice(cursor), match: false })
  return parts.length ? parts : [{ text: source, match: false }]
}

function snippetFor(text, query, radius = DEFAULT_RADIUS) {
  const source = String(text || '').replace(/\s+/g, ' ').trim()
  const idx = firstIndex(source, query)
  if (idx < 0) return null

  const start = Math.max(0, idx - radius)
  const end = Math.min(source.length, idx + query.length + radius)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < source.length ? '...' : ''
  return `${prefix}${source.slice(start, end)}${suffix}`
}

export function buildSearchPreview(entry, query) {
  const q = cleanQuery(query)
  if (!q) return { titleMatches: false, snippets: [] }

  const snippets = []
  const titleMatches = firstIndex(entry.title, q) >= 0
  const noteSnippet = snippetFor(entry.note, q)
  const urlSnippet = snippetFor(entry.url, q)
  const tagHits = (entry.tags || []).filter((tag) => firstIndex(tag, q) >= 0)

  if (noteSnippet) snippets.push({ field: 'note', text: noteSnippet })
  if (urlSnippet) snippets.push({ field: 'url', text: urlSnippet })
  if (tagHits.length) snippets.push({ field: 'tag', text: tagHits.map((tag) => `#${tag}`).join(' ') })

  return { titleMatches, snippets: snippets.slice(0, 2) }
}
