function stripDiacritics(value) {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

export function headingSlug(value) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!text) return ''

  return stripDiacritics(text)
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{Letter}\p{Number}\s_-]+/gu, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function createHeadingSlugger() {
  const seen = new Map()

  return (value) => {
    const base = headingSlug(value)
    const count = seen.get(base) || 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }
}

export function parseHeadings(markdown) {
  if (!markdown) return []

  const slug = createHeadingSlugger()
  const headings = []
  let inFence = false

  for (const rawLine of String(markdown).split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    const fence = line.match(/^(```+|~~~+)/)
    if (fence) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/)
    if (!match) continue

    const text = match[2].trim()
    if (!text) continue

    headings.push({
      depth: match[1].length,
      text,
      slug: slug(text),
    })
  }

  return headings
}
