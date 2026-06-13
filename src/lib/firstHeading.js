// Returns the text of a note's leading level-1 markdown heading (`# Heading`),
// or null. Used to build the per-topic table of contents.
export function firstHeading(note) {
  if (!note) return null
  for (const line of note.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const m = trimmed.match(/^#\s+(.*)$/)
    return m ? m[1].trim() : null
  }
  return null
}
