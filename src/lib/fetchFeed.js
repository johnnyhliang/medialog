// Fetch and parse an RSS/Atom feed via the allorigins CORS proxy.

const PROXY = 'https://api.allorigins.win/get?url='
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

async function fetchText(url) {
  const res = await fetch(PROXY + encodeURIComponent(url), { signal: AbortSignal.timeout(14000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.contents) throw new Error('empty response')
  return json.contents
}

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(str, n) {
  if (!str || str.length <= n) return str
  return str.slice(0, n).replace(/\s+\S*$/, '') + '…'
}

function parseDate(str) {
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function getLink(item) {
  // Atom: <link href="..."/> or <link>url</link>
  const linkEl = item.querySelector('link')
  if (linkEl) {
    return linkEl.getAttribute('href') || linkEl.textContent.trim()
  }
  // RSS: <guid isPermaLink="true"> or just text
  const guid = item.querySelector('guid')
  if (guid) {
    const text = guid.textContent.trim()
    if (text.startsWith('http')) return text
  }
  return null
}

function parseItems(xml) {
  const isAtom = !!xml.querySelector('feed')
  const selector = isAtom ? 'entry' : 'item'
  const items = [...xml.querySelectorAll(selector)]

  return items.map((item) => {
    const title = stripHtml(item.querySelector('title')?.textContent) || 'Untitled'
    const url = getLink(item)
    const rawSummary =
      item.querySelector('summary')?.textContent ||
      item.querySelector('description')?.textContent ||
      item.querySelector('content')?.textContent ||
      ''
    const summary = truncate(stripHtml(rawSummary), 240)
    const pubStr =
      item.querySelector('published')?.textContent ||
      item.querySelector('updated')?.textContent ||
      item.querySelector('pubDate')?.textContent ||
      null
    const published_at = parseDate(pubStr)
    const expires_at = new Date(Date.now() + FOURTEEN_DAYS).toISOString()

    return { title, url, summary, published_at, expires_at }
  }).filter((x) => x.url && x.url.startsWith('http'))
}

export async function fetchFeedItems(feedUrl) {
  const text = await fetchText(feedUrl)
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  if (xml.querySelector('parsererror')) throw new Error('Could not parse feed XML')
  const items = parseItems(xml)
  if (!items.length) throw new Error('No items found in feed')
  return items
}
