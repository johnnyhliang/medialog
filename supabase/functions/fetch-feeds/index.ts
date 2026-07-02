// Scheduled poller: fetches every user feed server-side, applies quality
// thresholds (reddit score filter), and upserts into feed_items.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseFeed } from 'https://deno.land/x/rss@1.0.0/mod.ts'

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000
const UA = 'medialog-feed-bot/1.0'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

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

async function fetchRss(url: string): Promise<Item[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const feed = await parseFeed(await res.text())
  return feed.entries
    .map((e) => ({
      title: stripHtml(e.title?.value ?? '') || 'Untitled',
      url: e.links?.[0]?.href ?? (e.id?.startsWith('http') ? e.id : ''),
      summary: truncate(stripHtml(e.description?.value ?? e.content?.value ?? ''), 240) || null,
      published_at: (e.published ?? e.updated)?.toISOString() ?? null,
    }))
    .filter((x) => x.url.startsWith('http'))
}

async function fetchReddit(feedUrl: string, minScore: number): Promise<Item[]> {
  const m = feedUrl.match(/reddit\.com\/r\/([^/?#]+)/i)
  if (!m) throw new Error('not a subreddit url')
  const sub = m[1]
  const res = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=50&raw_json=1`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  const posts = (body?.data?.children ?? []).map((c: { data: Record<string, unknown> }) => c.data)
  return posts
    .filter((p: Record<string, unknown>) => (p.score as number) >= minScore && !p.stickied)
    .map((p: Record<string, unknown>) => ({
      title: stripHtml(String(p.title)),
      // link posts point at the content; self posts at the discussion
      url: p.is_self ? `https://www.reddit.com${p.permalink}` : String(p.url),
      summary: truncate(
        `${p.score}↑ r/${sub}` + (p.selftext ? ` — ${stripHtml(String(p.selftext))}` : ''),
        240,
      ),
      published_at: new Date((p.created_utc as number) * 1000).toISOString(),
    }))
    .filter((x: Item) => x.url.startsWith('http'))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    if (req.headers.get('X-Cron-Secret') !== cronSecret) {
      return json({ error: 'forbidden' }, 403)
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: feeds, error: feedsErr } = await supabase.from('feeds').select('*')
  if (feedsErr) return json({ error: feedsErr.message }, 500)

  const results: Record<string, string | number> = {}
  let inserted = 0

  for (const feed of feeds ?? []) {
    try {
      const items = feed.kind === 'reddit'
        ? await fetchReddit(feed.url, feed.min_score ?? 100)
        : await fetchRss(feed.url)

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
