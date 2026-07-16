import GithubSlugger from 'github-slugger'

// Strip inline markdown so heading text matches what rehype-slug slugs from the
// rendered text content (links → their text, code/emphasis removed).
function stripInline(s) {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extract ATX headings (#..######) from markdown as { level, text, slug }.
// Slugs are produced with github-slugger — the same library rehype-slug uses to
// set element ids in MarkdownView — so a slug here matches the DOM id there,
// including duplicate de-duping (foo, foo-1, foo-2). Fenced code is skipped.
export function extractHeadings(markdown) {
  const lines = String(markdown ?? '').split('\n')
  const slugger = new GithubSlugger()
  const out = []
  let inFence = false
  for (const raw of lines) {
    const line = raw.trim()
    if (/^(```|~~~)/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const text = stripInline(m[2])
    if (!text) continue
    out.push({ level: m[1].length, text, slug: slugger.slug(text) })
  }
  return out
}
