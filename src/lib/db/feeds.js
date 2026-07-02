// DB operations for feeds and feed_items.

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
