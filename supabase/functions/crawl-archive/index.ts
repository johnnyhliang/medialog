// Crawl a site for article URLs via sitemap.xml or RSS/Atom.
//
// Moved server-side from src/lib/crawlArchive.js, which routed through the free
// allorigins.win CORS proxy — a third-party single point of failure that could
// rate-limit or vanish, silently breaking archive crawling. Edge functions have
// no CORS constraint, so the proxy is simply unnecessary here.
//
// Parsing is regex-based rather than DOM-based: Deno has no DOMParser, and this
// mirrors the self-contained parser already proven against every source in the
// feed starter pack (see fetch-feeds/index.ts).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { isSafeUrl } from '../_shared/isSafeUrl.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'content-type': 'application/json' },
  })
}

function decodeEntities(s: string): string {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
}

function tagText(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return m ? decodeEntities(m[1]).trim() : ''
}

function getLink(block: string): string {
  const alt = block.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i)
    || block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']alternate["']/i)
    || block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i)
  if (alt) return alt[1]
  const txt = block.match(/<link>\s*([\s\S]*?)\s*<\/link>/i)
  if (txt && /^https?:/i.test(txt[1].trim())) return txt[1].trim()
  const guid = block.match(/<guid[^>]*>\s*(https?:[^<]+?)\s*<\/guid>/i)
  return guid ? guid[1].trim() : ''
}

async function fetchText(url: string): Promise<string> {
  // Re-checked per URL, not just on the user's input: sitemap indexes point at
  // child sitemaps, and a hostile site could aim those at internal addresses.
  if (!isSafeUrl(url)) throw new Error('unsafe url')
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { 'User-Agent': 'medialog-crawler/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

function looksLikePost(url: string): boolean {
  try {
    const p = new URL(url).pathname
    if (p === '/' || p === '') return false
    if (/\.(xml|rss|css|js|png|jpg|jpeg|svg|ico|webp|pdf)$/i.test(p)) return false
    if (/\/(tag|tags|category|categories|archive|page|wp-content|feed|author)\//i.test(p)) return false
    return true
  } catch { return false }
}

function titleFromUrl(url: string): string {
  try {
    const slug = new URL(url).pathname.replace(/\/$/, '').split('/').at(-1) || ''
    return slug.replace(/[-_]/g, ' ').replace(/\.\w+$/, '').trim()
  } catch { return url }
}

// simonwillison.net's sitemap alone yields ~16.8k URLs. Returning all of them is a
// multi-megabyte JSON body that also overwhelms the picker UI, so cap the result.
// Newest-first is the useful end for an archive crawl, and sitemaps/feeds are
// conventionally ordered that way.
const MAX_ITEMS = 500

const blocks = (xml: string, tag: string): string[] =>
  xml.match(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi')) ?? []

// <loc> values inside <url> blocks (a normal sitemap).
function sitemapUrls(xml: string): string[] {
  return blocks(xml, 'url').map((b) => tagText(b, 'loc')).filter(Boolean)
}

// <loc> values inside <sitemap> blocks (a sitemap index).
function childSitemaps(xml: string): string[] {
  return blocks(xml, 'sitemap').map((b) => tagText(b, 'loc')).filter(Boolean)
}

async function trySitemap(base: string) {
  for (const url of [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`, `${base}/sitemap-posts.xml`]) {
    try {
      const text = await fetchText(url)

      const children = childSitemaps(text)
      if (children.length) {
        const all: string[] = []
        // Capped at 6 children: enough for a typical yearly/monthly split,
        // bounded so one huge index can't run the function to its timeout.
        for (const sub of children.slice(0, 6)) {
          try { all.push(...sitemapUrls(await fetchText(sub))) } catch { /* skip */ }
        }
        const posts = all.filter(looksLikePost)
        if (posts.length) {
          return posts.slice(0, MAX_ITEMS).map((u) => ({ url: u, title: titleFromUrl(u) }))
        }
      }

      const locs = sitemapUrls(text).filter(looksLikePost)
      if (locs.length) {
        return locs.slice(0, MAX_ITEMS).map((u) => ({ url: u, title: titleFromUrl(u) }))
      }
    } catch { /* try the next candidate */ }
  }
  return null
}

async function tryFeed(base: string) {
  const candidates = [
    `${base}/feed`, `${base}/rss`, `${base}/rss.xml`, `${base}/atom.xml`,
    `${base}/feed.xml`, `${base}/index.xml`, `${base}/blog/feed`, `${base}/blog/rss.xml`,
  ]
  for (const url of candidates) {
    try {
      const text = await fetchText(url)
      const items = [...blocks(text, 'item'), ...blocks(text, 'entry')]
      if (!items.length) continue
      const parsed = items
        .map((b) => ({ url: getLink(b), title: tagText(b, 'title') || 'Untitled' }))
        .filter((x) => x.url && /^https?:/i.test(x.url))
      if (parsed.length) return parsed.slice(0, MAX_ITEMS)
    } catch { /* try the next candidate */ }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  // Logged-in users only. Without this the function is an open URL fetcher that
  // anyone could point at arbitrary hosts using our egress.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  const input = body?.url
  if (!input || typeof input !== 'string') return json({ error: 'url is required' }, 400)

  let base: string
  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`)
    base = `${u.protocol}//${u.host}`
  } catch {
    return json({ error: 'Invalid URL' }, 400)
  }
  if (!isSafeUrl(base)) return json({ error: 'URL must be a public http(s) address' }, 400)

  try {
    const sitemap = await trySitemap(base)
    if (sitemap) return json({ items: sitemap, via: 'sitemap' })

    const feed = await tryFeed(base)
    if (feed) return json({ items: feed, via: 'feed' })

    return json({ error: 'No sitemap or feed found at this domain.' }, 404)
  } catch (e) {
    return json({ error: 'crawl failed', detail: String(e).slice(0, 200) }, 502)
  }
})
