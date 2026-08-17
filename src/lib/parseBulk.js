// Splits a textarea blob into entry items, one per non-blank line.
//
// A line may carry the reason it was saved, after a separator:
//
//   https://some.tool/  — replace my janky rechunk script
//   https://blog.post/  | the RRF explanation I keep re-googling
//
// That reason lands in `note`, which matters more than it looks: an entry with
// no note renders as a bookmark card and dims after two weeks, so a bulk paste
// of bare URLs reconstitutes the tab graveyard inside the app. Making the "why"
// cheap to type at capture time is the whole point of this parser.
//
// Otherwise: a line that parses as an http(s) URL becomes { url, note: '' };
// anything else becomes a plain note { url: null, note }.

// Em dash, en dash, pipe, one or two hyphens, or a double colon — each must be
// surrounded by whitespace. That guard is what keeps hyphenated paths intact:
// a URL cannot contain a space, so `a.com/foo-bar` can never match.
const SEPARATOR = /\s(?:—|–|\||--|-|::)(?:\s|$)/

export function parseBulk(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parseLine)
}

function parseLine(line) {
  const match = SEPARATOR.exec(line)
  if (match) {
    const url = line.slice(0, match.index).trim()
    const note = line.slice(match.index + match[0].length).trim()
    // Only treat it as url+reason if the left side really is a URL. Otherwise
    // the line is prose that happens to contain a dash, and must stay whole.
    if (isUrl(url)) return { url, note }
  }
  return isUrl(line) ? { url: line, note: '' } : { url: null, note: line }
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
