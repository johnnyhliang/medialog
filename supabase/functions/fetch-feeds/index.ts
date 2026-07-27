// Scheduled poller: fetches every user feed server-side and upserts into
// feed_items. Uses a self-contained RSS/Atom parser (no third-party feed lib,
// which silently choked on several of our sources).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000
const UA = 'medialog-feed-bot/1.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

interface Item {
  title: string
  url: string
  summary: string | null
  published_at: string | null
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(str: string, n: number): string {
  if (!str || str.length <= n) return str
  return str.slice(0, n).replace(/\s+\S*$/, '') + '…'
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

// Works for both RSS <item> and Atom <entry>.
function getLink(block: string): string {
  // Atom: prefer rel="alternate", else first <link href>
  const alt = block.match(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i)
    || block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']alternate["']/i)
    || block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i)
  if (alt) return alt[1]
  // RSS: <link>url</link>
  const txt = block.match(/<link>\s*([\s\S]*?)\s*<\/link>/i)
  if (txt && /^https?:/i.test(txt[1].trim())) return txt[1].trim()
  const guid = block.match(/<guid[^>]*>\s*(https?:[^<]+?)\s*<\/guid>/i)
  return guid ? guid[1].trim() : ''
}

// Self-contained RSS/Atom parse. Handles every source in our starter pack
// (verified) plus Reddit's Atom top.rss feed.
function parseXml(xml: string): Item[] {
  let blocks = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0])
  if (!blocks.length) blocks = [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map((m) => m[0])
  return blocks
    .map((b) => {
      const rawSummary = tagText(b, 'description') || tagText(b, 'summary') || tagText(b, 'content')
      const pub = tagText(b, 'pubDate') || tagText(b, 'published') || tagText(b, 'updated') || tagText(b, 'dc:date')
      const d = pub ? new Date(pub) : null
      return {
        title: stripHtml(tagText(b, 'title')) || 'Untitled',
        url: getLink(b),
        summary: truncate(stripHtml(rawSummary), 240) || null,
        published_at: d && !isNaN(d.getTime()) ? d.toISOString() : null,
      }
    })
    .filter((x) => x.url.startsWith('http'))
}

async function fetchXml(url: string): Promise<Item[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const items = parseXml(await res.text())
  if (!items.length) throw new Error('no items parsed')
  return items
}

// Reddit's JSON endpoints now 403 bots, but the Atom feed at /r/<sub>/top.rss
// still serves. We lose the numeric score, but top?t=day is already the day's
// best, so it stands in for the score gate.
async function fetchReddit(feedUrl: string): Promise<Item[]> {
  const m = feedUrl.match(/reddit\.com\/r\/([^/?#]+)/i)
  if (!m) throw new Error('not a subreddit url')
  return fetchXml(`https://www.reddit.com/r/${m[1]}/top.rss?t=day&limit=25`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Two callers:
  //   1. Scheduled cron with X-Cron-Secret → polls EVERY user's feeds.
  //   2. A logged-in user from the app (Authorization bearer) → polls only
  //      their own feeds, on demand (this is what makes the Feed view load).
  const cronSecret = Deno.env.get('CRON_SECRET')
  const authHeader = req.headers.get('Authorization')
  let targetUserId: string | null = null

  if (cronSecret && req.headers.get('X-Cron-Secret') === cronSecret) {
    targetUserId = null // all users
  } else if (authHeader) {
    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    targetUserId = user.id
  } else {
    return json({ error: 'forbidden' }, 403)
  }

  const feedsQuery = supabase.from('feeds').select('*')
  if (targetUserId) feedsQuery.eq('user_id', targetUserId)
  const { data: feeds, error: feedsErr } = await feedsQuery
  if (feedsErr) return json({ error: feedsErr.message }, 500)

  const results: Record<string, string | number> = {}
  let inserted = 0

  for (const feed of feeds ?? []) {
    try {
      const items = feed.kind === 'reddit'
        ? await fetchReddit(feed.url)
        : await fetchXml(feed.url)

      if (items.length > 0) {
        const rows = items.map((it) => ({
          user_id: feed.user_id,
          feed_id: feed.id,
          title: it.title.slice(0, 500),
          url: it.url.slice(0, 2000),
          summary: it.summary ? it.summary.slice(0, 500) : null,
          published_at: it.published_at,
          expires_at: new Date(Date.now() + FOURTEEN_DAYS).toISOString(),
        }))
        const { error, count } = await supabase
          .from('feed_items')
          .upsert(rows, { onConflict: 'user_id,url', ignoreDuplicates: true, count: 'exact' })
        if (error) throw new Error(error.message)
        inserted += count ?? 0
      }

      await supabase.from('feeds')
        .update({ last_fetched_at: new Date().toISOString() })
        .eq('id', feed.id)
      results[feed.name] = items.length
    } catch (err) {
      results[feed.name] = `error: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  // cull expired, unsaved items
  await supabase.from('feed_items')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .is('saved_at', null)

  return json({ feeds: (feeds ?? []).length, inserted, results })
})
