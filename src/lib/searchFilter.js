// Build a safe PostgREST `.or()` filter for entry search.
// User input is neutralized so it can't inject into the or-filter grammar
// (commas/parens separate and group conditions) or abuse LIKE wildcards.
// Result is a plain case-insensitive substring match over note + title.
export function buildSearchFilter(query) {
  const safe = query.replace(/[,()"\\*%_]/g, '').trim()
  return `note.ilike.%${safe}%,title.ilike.%${safe}%`
}
