// Matches [[entry:UUID]] or [[entry:UUID|label]]
export const EMBED_RE = /\[\[entry:([0-9a-fA-F-]+)(?:\|([^\]]+))?\]\]/g

export function extractEmbedIds(markdown) {
  const ids = []
  const seen = new Set()
  const re = new RegExp(EMBED_RE.source, 'g')
  let m
  while ((m = re.exec(String(markdown ?? '')))) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      ids.push(m[1])
    }
  }
  return ids
}

export function expandEmbedSyntax(markdown, getTitle) {
  return String(markdown ?? '').replace(
    new RegExp(EMBED_RE.source, 'g'),
    (_full, id, label) => {
      const text = label || getTitle(id) || 'missing entry'
      return `[${text}](entry:${id})`
    }
  )
}
