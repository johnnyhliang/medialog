import { useEffect, useMemo, useRef, useState } from 'react'
import {
  listFeeds, createFeed, deleteFeed, setFeedCategory,
  listFeedItems, dismissFeedItem,
  markFeedItemSaved, cullExpiredItems, getFeedItemCounts,
  addStarterFeeds,
} from '../lib/db/feeds.js'
import { existingCategories, resolveCategory, UNCATEGORIZED } from '../lib/feedCategories.js'
import { buildInterestProfile, sortByRelevance } from '../lib/feedRelevance.js'
import { listRecentActivity } from '../lib/db/entries.js'
import { STARTER_PACK } from '../lib/feedStarterPack.js'
import GainsCard from './GainsCard.jsx'

const STALE_MS = 60 * 60 * 1000 // re-fetch if older than 1 hour

function timeAgo(str) {
  if (!str) return null
  const diff = Date.now() - new Date(str).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export default function FeedView({ supabase, topics, allTags = [], onSaveItem, addToast, onOpenTopic, onOpenPatternTopic }) {
  const [feeds, setFeeds] = useState([])
  const [recentTitles, setRecentTitles] = useState([])
  const [counts, setCounts] = useState({})
  const [selectedFeedId, setSelectedFeedId] = useState(null) // null = all
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [refreshing, setRefreshing] = useState(false) // server poll in flight
  const [error, setError] = useState(null)
  const [savingItem, setSavingItem] = useState(null) // item id being saved
  const [saveTopicId, setSaveTopicId] = useState('')
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  // '' = uncategorized, '__new' = reveal the free-text field, anything else is
  // an existing category picked from the list.
  const [categoryMode, setCategoryMode] = useState('')
  // Manage mode reveals the per-feed category picker + delete button. Needed
  // because hover-only affordances don't exist on touch.
  const [managing, setManaging] = useState(false)
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState(null)
  const [packBusy, setPackBusy] = useState(false)
  const [sortMode, setSortMode] = useState(() => {
    try { return localStorage.getItem('medialog_feed_sort') || 'relevant' } catch { return 'relevant' }
  })
  const [hideLowSignal, setHideLowSignal] = useState(() => {
    try { return localStorage.getItem('medialog_feed_hide_lowsignal') === 'true' } catch { return false }
  })
  const [itemSearch, setItemSearch] = useState('')

  function chooseSort(mode) {
    setSortMode(mode)
    try { localStorage.setItem('medialog_feed_sort', mode) } catch {}
  }
  function toggleHideLowSignal() {
    setHideLowSignal((v) => {
      const next = !v
      try { localStorage.setItem('medialog_feed_hide_lowsignal', String(next)) } catch {}
      return next
    })
  }
  const polledRef = useRef(false) // whether we've triggered a server poll this session

  const nonInbox = topics.filter((t) => t.name !== 'Inbox')

  // Interest profile from topics + tags + recurring words in recent entry
  // titles — the sharper the signal, the better Relevant mode ranks.
  const interestProfile = useMemo(
    () => buildInterestProfile({ topics, tags: allTags, titles: recentTitles }),
    [topics, allTags, recentTitles],
  )

  // Items to render: text filter, then either newest (default query order) or
  // ranked against the interest profile.
  const displayItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    const base = q
      ? items.filter((it) =>
          `${it.title} ${it.summary ?? ''}`.toLowerCase().includes(q))
      : items
    if (sortMode !== 'relevant') return base
    const ranked = sortByRelevance(base, interestProfile)
    // "only matches" hides zero-signal items (e.g. off-topic papers) — but only
    // when the profile actually has terms, so it can't blank the whole feed.
    return hideLowSignal && interestProfile.size > 0
      ? ranked.filter((it) => it._relevance > 0)
      : ranked
  }, [items, itemSearch, sortMode, interestProfile, hideLowSignal])

  // on mount: cull expired items, load feeds + counts
  useEffect(() => {
    cullExpiredItems(supabase).catch(() => {})
    loadFeeds()
    // Recent entry titles sharpen the relevance profile beyond topic names.
    listRecentActivity(supabase, 60)
      .then((rows) => setRecentTitles((rows ?? []).map((r) => r.title).filter(Boolean)))
      .catch(() => {})
  }, [])

  // reload items when selected feed changes
  useEffect(() => {
    loadItems(selectedFeedId)
  }, [selectedFeedId])

  // once feeds are loaded, poll the server if anything is stale
  useEffect(() => {
    if (polledRef.current || feeds.length === 0) return
    const anyStale = feeds.some((f) =>
      !f.last_fetched_at || Date.now() - new Date(f.last_fetched_at).getTime() > STALE_MS)
    if (anyStale) { polledRef.current = true; serverRefresh() }
  }, [feeds])

  async function loadFeeds() {
    const [f, c] = await Promise.all([
      listFeeds(supabase),
      getFeedItemCounts(supabase),
    ])
    setFeeds(f)
    setCounts(c)
  }

  async function loadItems(feedId) {
    setLoadingItems(true)
    setError(null)
    try {
      const data = await listFeedItems(supabase, feedId)
      setItems(data)
    } catch (err) {
      setError(err.message)
    }
    setLoadingItems(false)
  }

  // Poll all of the user's feeds server-side (reliable, handles Reddit, no
  // browser CORS), then reload what's on screen.
  async function serverRefresh() {
    if (refreshing || feeds.length === 0) return
    setRefreshing(true)
    setError(null)
    try {
      const { error: fnErr } = await supabase.functions.invoke('fetch-feeds')
      if (fnErr) throw fnErr
    } catch {
      setError('Could not refresh feeds right now. Try again in a moment.')
    }
    await loadItems(selectedFeedId)
    const [f, c] = await Promise.all([listFeeds(supabase), getFeedItemCounts(supabase)])
    setFeeds(f)
    setCounts(c)
    setRefreshing(false)
  }

  async function handleRefresh() {
    polledRef.current = true
    await serverRefresh()
  }

  async function handleDismiss(item) {
    setItems((prev) => prev.filter((x) => x.id !== item.id))
    try {
      await dismissFeedItem(supabase, item.id)
    } catch {
      addToast?.('Failed to dismiss item', 'error')
      setItems((prev) => [item, ...prev])
      return
    }
    setCounts((prev) => ({ ...prev, [item.feed_id]: Math.max(0, (prev[item.feed_id] || 1) - 1) }))
  }

  async function handleSave(item, topicId) {
    if (!topicId) return
    setSavingItem(null)
    setItems((prev) => prev.filter((x) => x.id !== item.id))
    try {
      await markFeedItemSaved(supabase, item.id)
      await onSaveItem({ url: item.url, title: item.title, note: '' }, topicId)
    } catch {
      addToast?.('Failed to save item', 'error')
      setItems((prev) => [item, ...prev])
      return
    }
    setCounts((prev) => ({ ...prev, [item.feed_id]: Math.max(0, (prev[item.feed_id] || 1) - 1) }))
  }

  async function handleMoveFeed(feed, rawCategory) {
    const category = resolveCategory(rawCategory, feeds)
    const previous = feed.category ?? null
    if (category === previous) return
    setFeeds((prev) => prev.map((f) => (f.id === feed.id ? { ...f, category } : f)))
    try {
      await setFeedCategory(supabase, feed.id, category)
    } catch {
      setFeeds((prev) => prev.map((f) => (f.id === feed.id ? { ...f, category: previous } : f)))
      addToast?.('Could not move that feed', 'error')
    }
  }

  async function handleAddFeed() {
    if (!newUrl.trim() || !newName.trim() || addBusy) return
    setAddBusy(true)
    setAddError(null)
    try {
      const url = newUrl.trim()
      const isReddit = /reddit\.com\/r\//i.test(url)
      const feed = await createFeed(supabase, {
        url,
        name: newName.trim(),
        // Reuses an existing spelling when one matches case-insensitively, so
        // "Writers" joins "writers" instead of forking a twin group.
        category: resolveCategory(newCategory, feeds),
        kind: isReddit ? 'reddit' : 'rss',
        min_score: isReddit ? 100 : null,
      })
      setFeeds((prev) => [...prev, feed].sort((a, b) => a.name.localeCompare(b.name)))
      setNewUrl(''); setNewName(''); setNewCategory(''); setCategoryMode('')
      setShowAddFeed(false)
    } catch (err) {
      setAddError(err.message)
    }
    setAddBusy(false)
  }

  async function handleAddStarterPack() {
    if (packBusy) return
    setPackBusy(true)
    try {
      const added = await addStarterFeeds(supabase, STARTER_PACK)
      addToast?.(added.length ? `Added ${added.length} sources — fetching now…` : 'Already following all starter sources')
      await loadFeeds()
      polledRef.current = true
      await serverRefresh()
    } catch (err) {
      addToast?.(`Failed to add starter pack: ${err.message}`, 'error')
    }
    setPackBusy(false)
  }

  async function handleDeleteFeed(feed) {
    if (!confirm(`Remove "${feed.name}" and all its unread items?`)) return
    await deleteFeed(supabase, feed.id)
    setFeeds((prev) => prev.filter((f) => f.id !== feed.id))
    if (selectedFeedId === feed.id) setSelectedFeedId(null)
    await loadItems(null)
  }

  // group feeds by category for sidebar
  const feedsByCategory = feeds.reduce((acc, f) => {
    const cat = f.category || UNCATEGORIZED
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(f)
    return acc
  }, {})
  const totalUnread = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="feed-view">
      {/* ── sidebar ── */}
      <div className="feed-sidebar">
        <div className="feed-sidebar-header">
          <span className="section-label" style={{ margin: 0 }}>feeds</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="feed-add-btn"
              onClick={handleRefresh}
              disabled={refreshing || feeds.length === 0}
              title="Refresh all feeds"
            >{refreshing ? '…' : '↻'}</button>
            {/* Hover-reveal hid the category picker and delete button entirely
                on touch, where there is no hover. An explicit toggle matches the
                tools-shelf pattern and works everywhere. */}
            <button
              className={`feed-add-btn ${managing ? 'active' : ''}`}
              onClick={() => setManaging((v) => !v)}
              disabled={feeds.length === 0}
              title="Move or remove feeds"
            >{managing ? 'done' : 'edit'}</button>
            <button
              className="feed-add-btn"
              onClick={() => setShowAddFeed((v) => !v)}
              title="Add feed"
            >+</button>
          </div>
        </div>

        {showAddFeed && (
          <div className="feed-add-form">
            <input
              type="url"
              placeholder="feed url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
            <input
              placeholder="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            {/* Picking from what exists is the fix for the real failure mode:
                retyping a category by hand and landing a feed in a near-duplicate
                group. Free text stays available behind "+ new category". */}
            <select
              value={categoryMode}
              onChange={(e) => {
                setCategoryMode(e.target.value)
                if (e.target.value !== '__new') setNewCategory(e.target.value)
                else setNewCategory('')
              }}
              aria-label="category"
            >
              <option value="">uncategorized</option>
              {existingCategories(feeds).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new">+ new category…</option>
            </select>
            {categoryMode === '__new' && (
              <input
                placeholder="new category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                aria-label="new category name"
              />
            )}
            {addError && <p className="muted" style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{addError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleAddFeed} disabled={addBusy || !newUrl || !newName}>
                {addBusy ? 'adding…' : 'add'}
              </button>
              <button onClick={() => { setShowAddFeed(false); setAddError(null) }}>cancel</button>
            </div>
          </div>
        )}

        <div className="feed-nav">
          <button
            className={`feed-nav-item ${selectedFeedId === null ? 'active' : ''}`}
            onClick={() => setSelectedFeedId(null)}
          >
            <span>all feeds</span>
            {totalUnread > 0 && <span className="feed-count">{totalUnread}</span>}
          </button>

          {Object.entries(feedsByCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catFeeds]) => (
            <div key={cat}>
              <p className="feed-category-label">{cat}</p>
              {catFeeds.map((feed) => (
                <div key={feed.id} className={`feed-nav-item-wrap ${managing ? 'managing' : ''}`}>
                  <button
                    className={`feed-nav-item ${selectedFeedId === feed.id ? 'active' : ''}`}
                    onClick={() => setSelectedFeedId(feed.id)}
                  >
                    <span className="feed-nav-name">{feed.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {counts[feed.id] > 0 && <span className="feed-count">{counts[feed.id]}</span>}
                    </span>
                  </button>
                  <div className="feed-nav-actions">
                    {/* Re-file without deleting and re-adding — the only way to
                        recover a feed that landed in the wrong category. */}
                    <select
                      className="feed-cat-select"
                      value={feed.category || ''}
                      onChange={(e) => handleMoveFeed(feed, e.target.value)}
                      title="Move to category"
                      aria-label={`category for ${feed.name}`}
                    >
                      <option value="">{UNCATEGORIZED}</option>
                      {existingCategories(feeds).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      className="feed-action-btn"
                      onClick={() => handleDeleteFeed(feed)}
                      title="Remove feed"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── items panel ── */}
      <div className="feed-items">
        <GainsCard
          supabase={supabase}
          onOpenTopic={onOpenTopic}
          onOpenPatternTopic={onOpenPatternTopic}
          feedItems={items}
          interestProfile={interestProfile}
        />
        {items.length > 0 && (
          <div className="feed-toolbar">
            <input
              className="feed-item-search"
              placeholder="filter these items…"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
            <div className="feed-sort-toggle">
              <button
                className={`feed-sort-btn${sortMode === 'new' ? ' active' : ''}`}
                onClick={() => chooseSort('new')}
              >Newest</button>
              <button
                className={`feed-sort-btn${sortMode === 'relevant' ? ' active' : ''}`}
                onClick={() => chooseSort('relevant')}
                title="Rank by overlap with your topics, tags, and recent reading"
              >Relevant</button>
            </div>
            {sortMode === 'relevant' && (
              <label className="feed-only-matches" title="Hide items that don't match your interests (e.g. off-topic papers)">
                <input type="checkbox" checked={hideLowSignal} onChange={toggleHideLowSignal} />
                only matches
              </label>
            )}
          </div>
        )}

        {error && <p className="muted" style={{ padding: '24px 32px', fontSize: '0.8rem' }}>{error}</p>}

        {refreshing && items.length === 0 && (
          <p className="muted" style={{ padding: '24px 32px', fontSize: '0.8rem' }}>fetching latest…</p>
        )}

        {!error && !loadingItems && !refreshing && items.length === 0 && (
          <div className="feed-empty">
            <p className="muted">
              {feeds.length === 0
                ? 'no feeds yet — add one, or start with the curated pack.'
                : 'nothing new. check back later or refresh a feed.'}
            </p>
            {feeds.length === 0 && (
              <button onClick={handleAddStarterPack} disabled={packBusy}>
                {packBusy ? 'adding…' : `add starter pack (${STARTER_PACK.length} sources)`}
              </button>
            )}
          </div>
        )}

        {!refreshing && items.length > 0 && displayItems.length === 0 && (
          <p className="muted" style={{ padding: '24px 32px', fontSize: '0.8rem' }}>
            {itemSearch
              ? `no items match “${itemSearch}”.`
              : 'nothing matches your interests right now — untick “only matches” to see everything.'}
          </p>
        )}

        {displayItems.map((item) => (
          <div key={item.id} className="feed-item">
            <div className="feed-item-meta">
              <span className="feed-item-source">{item.feeds?.name || domain(item.url)}</span>
              <span className="feed-item-sep">·</span>
              <span className="feed-item-age">{timeAgo(item.published_at) || '—'}</span>
              {sortMode === 'relevant' && item._relevance > 0 && (
                <span className="feed-item-relevance" title="matches your topics">★ {item._relevance}</span>
              )}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="feed-item-title"
            >
              {item.title}
            </a>
            {item.summary && (
              <p className="feed-item-summary">{item.summary}</p>
            )}
            <div className="feed-item-actions">
              {savingItem === item.id ? (
                <div className="feed-save-picker">
                  <select
                    value={saveTopicId}
                    onChange={(e) => setSaveTopicId(e.target.value)}
                    autoFocus
                  >
                    <option value="">— pick topic —</option>
                    <option value="__inbox__">inbox (triage later)</option>
                    {nonInbox.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSave(item, saveTopicId === '__inbox__'
                      ? topics.find((t) => t.name === 'Inbox')?.id
                      : saveTopicId
                    )}
                    disabled={!saveTopicId}
                  >save</button>
                  <button onClick={() => setSavingItem(null)}>cancel</button>
                </div>
              ) : (
                <>
                  <button
                    className="feed-btn-save"
                    onClick={() => { setSavingItem(item.id); setSaveTopicId('') }}
                  >save →</button>
                  <button
                    className="feed-btn-dismiss"
                    onClick={() => handleDismiss(item)}
                  >dismiss</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
