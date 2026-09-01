// DB operations for feeds and feed_items.

import { loadEntitlement } from '../entitlements.js'
import { isOverLimit, limitFor } from '../limits.js'
import { unwrap, unwrapList } from './unwrap.js'
import { requireUser } from '../requireUser.js'

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
  return unwrapList(await supabase
    .from('feeds')
    .select('*')
    .order('category', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true }), 'listFeeds')
}

export async function createFeed(supabase, { url, name, category = null, kind = 'rss', min_score = null }) {
  // requireUser, not getUserOrNull: this only ever runs from the "add feed"
  // form, so there is no such thing as an anonymous createFeed to tolerate. A
  // null user here previously produced `user_id: undefined`, which RLS rejects
  // with an opaque policy error rather than "you are signed out".
  const user = await requireUser(supabase)

  // Feed count is really "how much recurring server-side work does this account
  // create" — every feed is a repeated fetch on a shared cron. Checked before the
  // insert so the user gets a clear limit message rather than a DB error.
  const { tier } = await loadEntitlement(supabase)
  const countRes = await supabase
    .from('feeds')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  // Called for its throw, not its return: a head+count query has no `data`, and
  // the count lives on the result object. Silently treating a failed count as 0
  // would let a user past their allowance whenever the database hiccuped.
  unwrap(countRes, 'createFeed.countFeeds')
  const count = countRes.count
  if (isOverLimit(tier, 'feeds', count ?? 0)) {
    throw new LimitError(
      `Your plan allows ${limitFor(tier, 'feeds')} feeds. Remove one, or upgrade for more.`,
      { key: 'feeds', limit: limitFor(tier, 'feeds'), tier },
    )
  }

  return unwrap(await supabase
    .from('feeds')
    .insert({ user_id: user.id, url, name, category, kind, min_score })
    .select()
    .single(), 'createFeed')
}

// Insert curated starter sources, skipping any URL the user already follows.
export async function addStarterFeeds(supabase, pack) {
  // Also a deliberate button press ("add the starter pack"), so a signed-out
  // caller is a bug rather than an expected state — requireUser.
  const user = await requireUser(supabase)
  const existing = await listFeeds(supabase)
  const have = new Set(existing.map((f) => f.url))
  const rows = pack
    .filter((f) => !have.has(f.url))
    .map((f) => ({ user_id: user.id, ...f, min_score: f.min_score ?? null }))
  if (rows.length === 0) return []
  return unwrapList(await supabase.from('feeds').insert(rows).select(), 'addStarterFeeds')
}

// Re-files a feed under a different category. null moves it to uncategorized.
export async function setFeedCategory(supabase, id, category) {
  unwrap(await supabase.from('feeds').update({ category }).eq('id', id), 'setFeedCategory')
}

export async function deleteFeed(supabase, id) {
  unwrap(await supabase.from('feeds').delete().eq('id', id), 'deleteFeed')
}

export async function markFeedFetched(supabase, id) {
  unwrap(await supabase
    .from('feeds')
    .update({ last_fetched_at: new Date().toISOString() })
    .eq('id', id), 'markFeedFetched')
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

  return unwrapList(await query, 'listFeedItems')
}

export async function upsertFeedItems(supabase, feedId, items) {
  // requireUser rather than getUserOrNull even though this is the ingestion
  // path: ingestion now runs in the `fetch-feeds` edge function, so nothing on
  // a timer calls this, and every row it writes needs a real user_id. Returning
  // null here would only defer the failure to `user.id` one line down.
  const user = await requireUser(supabase)
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
  unwrap(await supabase
    .from('feed_items')
    .upsert(rows, { onConflict: 'user_id,url', ignoreDuplicates: true }), 'upsertFeedItems')
}

export async function dismissFeedItem(supabase, id) {
  unwrap(await supabase
    .from('feed_items')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id), 'dismissFeedItem')
}

export async function markFeedItemSaved(supabase, id) {
  unwrap(await supabase
    .from('feed_items')
    .update({ saved_at: new Date().toISOString() })
    .eq('id', id), 'markFeedItemSaved')
}

export async function cullExpiredItems(supabase) {
  unwrap(await supabase
    .from('feed_items')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .is('saved_at', null), 'cullExpiredItems')
}

export async function getFeedItemCounts(supabase) {
  // This used to `return {}` on error, which rendered a broken query as "every
  // feed has zero unread items" — indistinguishable from a genuinely empty
  // inbox, and the exact lie §4.3 is about. It throws now; the sole caller
  // (FeedView.loadFeeds) should catch.
  const rows = unwrapList(await supabase
    .from('feed_items')
    .select('feed_id')
    .is('dismissed_at', null)
    .is('saved_at', null)
    .gt('expires_at', new Date().toISOString()), 'getFeedItemCounts')
  return rows.reduce((acc, row) => {
    acc[row.feed_id] = (acc[row.feed_id] || 0) + 1
    return acc
  }, {})
}
