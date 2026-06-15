// Splits a textarea blob into entry items, one per non-blank line.
// A line that parses as an http(s) URL becomes { url, note: '' };
// anything else becomes a plain note { url: null, note }.
export function parseBulk(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => (isUrl(line) ? { url: line, note: '' } : { url: null, note: line }))
}

function isUrl(s) {
  if (/\s/.test(s)) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
