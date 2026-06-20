// Crawl a blog/site for article URLs via sitemap.xml or RSS/Atom feed.
// Routes through allorigins.win to sidestep CORS.

const PROXY = 'https://api.allorigins.win/get?url='

async function fetchText(url) {
  const res = await fetch(PROXY + encodeURIComponent(url), { signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.contents) throw new Error('empty response')
  return json.contents
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml')
}

// --- sitemap ---
function extractSitemapItems(xml) {
  // sitemap index → recurse into sub-sitemaps (just grab their locs; we'll
  // try each one). For a regular sitemap, pull <url><loc> entries.
  const locs = [...xml.querySelectorAll('url > loc')].map((n) => n.textContent.trim())
  return locs
}

function looksLikePost(url) {
  try {
    const u = new URL(url)
    const p = u.pathname
    // skip root, tag pages, category pages, archives, feeds, assets
    if (p === '/' || p === '') return false
    if (/\.(xml|rss|css|js|png|jpg|jpeg|svg|ico|webp|pdf)$/i.test(p)) return false
    if (/\/(tag|tags|category|categories|archive|page|wp-content|feed|author)\//i.test(p)) return false
    return true
  } catch { return false }
}

function titleFromUrl(url) {
  try {
    const slug = new URL(url).pathname.replace(/\/$/, '').split('/').at(-1) || ''
    return slug.replace(/[-_]/g, ' ').replace(/\.\w+$/, '').trim()
  } catch { return url }
}

async function trySitemap(baseUrl) {
  const candidates = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap-posts.xml`,
  ]
  for (const url of candidates) {
    try {
      const text = await fetchText(url)
      const xml = parseXml(text)
      if (xml.querySelector('parsererror')) continue

      // sitemap index: recurse into first few child sitemaps
      const subSitemaps = [...xml.querySelectorAll('sitemap > loc')].map((n) => n.textContent.trim())
      if (subSitemaps.length > 0) {
        const allLocs = []
        for (const sub of subSitemaps.slice(0, 6)) {
          try {
            const subText = await fetchText(sub)
            const subXml = parseXml(subText)
            allLocs.push(...extractSitemapItems(subXml))
          } catch {}
        }
        const posts = allLocs.filter(looksLikePost)
        if (posts.length) return posts.map((u) => ({ url: u, title: titleFromUrl(u) }))
      }

      const locs = extractSitemapItems(xml).filter(looksLikePost)
      if (locs.length) return locs.map((u) => ({ url: u, title: titleFromUrl(u) }))
    } catch {}
  }
  return null
}

// --- RSS / Atom ---
async function tryFeed(baseUrl) {
  const candidates = [
    `${baseUrl}/feed`,
    `${baseUrl}/rss`,
    `${baseUrl}/rss.xml`,
    `${baseUrl}/atom.xml`,
    `${baseUrl}/feed.xml`,
    `${baseUrl}/index.xml`,
    `${baseUrl}/blog/feed`,
    `${baseUrl}/blog/rss.xml`,
  ]
  for (const url of candidates) {
    try {
      const text = await fetchText(url)
      const xml = parseXml(text)
      if (xml.querySelector('parsererror')) continue
      const items = [...xml.querySelectorAll('item, entry')]
      if (!items.length) continue
      return items.map((item) => {
        const title =
          item.querySelector('title')?.textContent?.trim() || 'Untitled'
        const link =
          item.querySelector('link')?.getAttribute('href') ||
          item.querySelector('link')?.textContent?.trim() ||
          item.querySelector('guid')?.textContent?.trim() ||
          ''
        return { url: link, title }
      }).filter((x) => x.url && x.url.startsWith('http'))
    } catch {}
  }
  return null
}

// --- public entry point ---
export async function crawlArchive(inputUrl) {
  let base
  try {
    const u = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`)
    base = `${u.protocol}//${u.host}`
  } catch {
    throw new Error('Invalid URL')
  }

  const sitemap = await trySitemap(base)
  if (sitemap) return { items: sitemap, via: 'sitemap' }

  const feed = await tryFeed(base)
  if (feed) return { items: feed, via: 'feed' }

  throw new Error('No sitemap or feed found at this domain.')
}
