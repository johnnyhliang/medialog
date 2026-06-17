const MAX_TITLE = 120

export function computeTitle(note, url) {
  const text = String(note ?? '')
  const lines = text.split('\n')

  // 1. First H1 (single # followed by a space)
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/)
    if (m) return m[1].trim().slice(0, MAX_TITLE)
  }

  // 2. First non-empty line
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) return trimmed.slice(0, MAX_TITLE)
  }

  // 3. URL  4. Untitled
  const u = String(url ?? '').trim()
  return u || 'Untitled'
}
