// Feed categories are free-text, which means "Writers", "writers " and
// "writers" silently became three separate sidebar groups. Grouping is an exact
// string match, so any casing or whitespace drift splits a category that the
// user believes is one thing.
//
// Rather than force a fixed taxonomy (categories are genuinely user-defined),
// canonicalize on write: trim, collapse inner whitespace, and reuse the existing
// spelling when one matches case-insensitively. The first spelling of a category
// wins and later additions join it.

export const UNCATEGORIZED = 'uncategorized'

export function normalizeCategory(raw) {
  const cleaned = String(raw ?? '').trim().replace(/\s+/g, ' ')
  return cleaned || null
}

// Distinct categories currently in use, compared case-insensitively so the
// picker never offers two spellings of the same thing.
export function existingCategories(feeds = []) {
  const seen = new Map()
  for (const f of feeds) {
    const cat = normalizeCategory(f?.category)
    if (!cat) continue
    const key = cat.toLowerCase()
    if (!seen.has(key)) seen.set(key, cat)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

// Resolves a typed category against what already exists. Returns the canonical
// existing spelling when it matches case-insensitively, so "Writers" files into
// "writers" instead of creating a twin.
export function resolveCategory(raw, feeds = []) {
  const cat = normalizeCategory(raw)
  if (!cat) return null
  const match = existingCategories(feeds).find((c) => c.toLowerCase() === cat.toLowerCase())
  return match ?? cat
}
