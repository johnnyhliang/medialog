// DB operations for feeds and feed_items.

import { loadEntitlement } from '../entitlements.js'
import { isOverLimit, limitFor } from '../limits.js'

// Thrown when a tier allowance is reached. Distinct from a generic Error so the
// UI can offer an upgrade rather than showing a failure — hitting a documented
// limit is not the same as something breaking.
export class LimitError extends Error {
  constructor(message, { key, limit, tier } = {}) {
    super(message)
    this.name = 'LimitError'
    this.isLimit = true
    this.key = key
    this.limit = limit
    this.tier = tier
  }
}

// ── Feeds ──────────────────────────────────────────────

export async function listFeeds(supabase) {
  const { data, error } = await supabase
    .from('feeds')
    .select('*')
    .order('category', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

export async function createFeed(supabase, { url, name, category = null, kind = 'rss', min_score = null }) {
  const { data: { user } } = await supabase.auth.getUser()

  // Feed count is really "how much recurring server-side work does this account
  // create" — every feed is a repeated fetch on a shared cron. Checked before the
  // insert so the user gets a clear limit message rather than a DB error.
  const { tier } = await loadEntitlement(supabase)
  const { count } = await supabase
    .from('feeds')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (isOverLimit(tier, 'feeds', count ?? 0)) {
    throw new LimitError(
      `Your plan allows ${limitFor(tier, 'feeds')} feeds. Remove one, or upgrade for more.`,
      { key: 'feeds', limit: limitFor(tier, 'feeds'), tier },
    )
  }

  const { data, error } = await supabase
    .from('feeds')
    .insert({ user_id: user.id, url, name, category, kind, min_score })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

// Insert curated starter sources, skipping any URL the user already follows.
export async function addStarterFeeds(supabase, pack) {
  const { data: { user } } = await supabase.auth.getUser()
  const existing = await listFeeds(supabase)
  const have = new Set(existing.map((f) => f.url))
  const rows = pack
    .filter((f) => !have.has(f.url))
    .map((f) => ({ user_id: user.id, ...f, min_score: f.min_score ?? null }))
  if (rows.length === 0) return []
  const { data, error } = await supabase.from('feeds').insert(rows).select()
  if (error) throw new Error(error.message)
  return data
}

// Re-files a feed under a different category. null moves it to uncategorized.
export async function setFeedCategory(supabase, id, category) {
  const { error } = await supabase.from('feeds').update({ category }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteFeed(supabase, id) {
  const { error } = await supabase.from('feeds').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function markFeedFetched(supabase, id) {
  const { error } = await supabase
    .from('feeds')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Feed items ─────────────────────────────────────────

export async function listFeedItems(supabase, feedId) {
  const query = supabase
    .from('feed_items')
    .select('*, feeds(name, category)')
    .is('dismissed_at', null)
    .is('saved_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(200)

  if (feedId) query.eq('feed_id', feedId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function upsertFeedItems(supabase, feedId, items) {
  const { data: { user } } = await supabase.auth.getUser()
  const rows = items.map((it) => ({
    user_id: user.id,
    feed_id: feedId,
    title: String(it.title).slice(0, 500),
    url: String(it.url).slice(0, 2000),
    summary: it.summary ? String(it.summary).slice(0, 500) : null,
    published_at: it.published_at,
    expires_at: it.expires_at,
  }))
  // on conflict (user_id, url) do nothing — don't overwrite already-saved items
  const { error } = await supabase
    .from('feed_items')
    .upsert(rows, { onConflict: 'user_id,url', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

export async function dismissFeedItem(supabase, id) {
  const { error } = await supabase
    .from('feed_items')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function markFeedItemSaved(supabase, id) {
  const { error } = await supabase
    .from('feed_items')
    .update({ saved_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function cullExpiredItems(supabase) {
  const { error } = await supabase
    .from('feed_items')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .is('saved_at', null)
  if (error) throw new Error(error.message)
}

export async function getFeedItemCounts(supabase) {
  const { data, error } = await supabase
    .from('feed_items')
    .select('feed_id')
    .is('dismissed_at', null)
    .is('saved_at', null)
    .gt('expires_at', new Date().toISOString())
  if (error) return {}
  return data.reduce((acc, row) => {
    acc[row.feed_id] = (acc[row.feed_id] || 0) + 1
    return acc
  }, {})
}
