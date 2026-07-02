import { useEffect, useRef, useState } from 'react'
import { fetchFeedItems } from '../lib/fetchFeed.js'
import {
  listFeeds, createFeed, deleteFeed, markFeedFetched,
  listFeedItems, upsertFeedItems, dismissFeedItem,
  markFeedItemSaved, cullExpiredItems, getFeedItemCounts,
  addStarterFeeds,
} from '../lib/db/feeds.js'
import { STARTER_PACK } from '../lib/feedStarterPack.js'

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

export default function FeedView({ supabase, topics, onSaveItem, addToast }) {
  const [feeds, setFeeds] = useState([])
  const [counts, setCounts] = useState({})
  const [selectedFeedId, setSelectedFeedId] = useState(null) // null = all
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [fetchingFeed, setFetchingFeed] = useState(null) // feed id currently refreshing
  const [error, setError] = useState(null)
  const [savingItem, setSavingItem] = useState(null) // item id being saved
  const [saveTopicId, setSaveTopicId] = useState('')
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState(null)
  const [packBusy, setPackBusy] = useState(false)
  const fetchedRef = useRef(new Set()) // feed ids fetched this session

  const nonInbox = topics.filter((t) => t.name !== 'Inbox')

  // on mount: cull expired items, load feeds + counts
  useEffect(() => {
    cullExpiredItems(supabase).catch(() => {})
    loadFeeds()
  }, [])

  // reload items when selected feed changes
  useEffect(() => {
    loadItems(selectedFeedId)
    maybeRefreshFeed(selectedFeedId)
  }, [selectedFeedId, feeds])

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

  // fetch from network if feed is stale and hasn't been fetched this session
  async function maybeRefreshFeed(feedId) {
    const toRefresh = feedId
      ? feeds.filter((f) => f.id === feedId)
      : feeds

    for (const feed of toRefresh) {
      if (feed.kind === 'reddit') continue // server-polled only (score filter)
      const stale = !feed.last_fetched_at ||
        Date.now() - new Date(feed.last_fetched_at).getTime() > STALE_MS
      if (!stale || fetchedRef.current.has(feed.id)) continue

      fetchedRef.current.add(feed.id)
      setFetchingFeed(feed.id)
      try {
        const fetched = await fetchFeedItems(feed.url)
        await upsertFeedItems(supabase, feed.id, fetched)
        await markFeedFetched(supabase, feed.id)
        await loadItems(selectedFeedId)
        const c = await getFeedItemCounts(supabase)
        setCounts(c)
      } catch {
        // silent — stale feed shouldn't break the view
      }
      setFetchingFeed(null)
    }
  }

  async function handleRefresh(feed) {
    fetchedRef.current.delete(feed.id)
    await maybeRefreshFeed(feed.id)
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
        category: newCategory.trim() || null,
        kind: isReddit ? 'reddit' : 'rss',
        min_score: isReddit ? 100 : null,
      })
      setFeeds((prev) => [...prev, feed].sort((a, b) => a.name.localeCompare(b.name)))
      setNewUrl(''); setNewName(''); setNewCategory('')
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
      addToast?.(added.length ? `Added ${added.length} sources — items arrive on the next poll` : 'Already following all starter sources')
      await loadFeeds()
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
    const cat = f.category || 'uncategorized'
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
          <button
            className="feed-add-btn"
            onClick={() => setShowAddFeed((v) => !v)}
            title="Add feed"
          >+</button>
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
            <input
              placeholder="category (optional)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            {addError && <p className="muted" style={{ fontSize: '0.75rem', color: 'var(--danger,#c0392b)' }}>{addError}</p>}
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
                <div key={feed.id} className="feed-nav-item-wrap">
                  <button
                    className={`feed-nav-item ${selectedFeedId === feed.id ? 'active' : ''}`}
                    onClick={() => setSelectedFeedId(feed.id)}
                  >
                    <span className="feed-nav-name">{feed.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {fetchingFeed === feed.id && <span className="feed-spinner" />}
                      {counts[feed.id] > 0 && <span className="feed-count">{counts[feed.id]}</span>}
                    </span>
                  </button>
                  <div className="feed-nav-actions">
                    <button
                      className="feed-action-btn"
                      onClick={() => handleRefresh(feed)}
                      title="Refresh"
                    >↻</button>
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
        {error && <p className="muted" style={{ padding: '24px 32px', fontSize: '0.8rem' }}>{error}</p>}

        {!error && !loadingItems && items.length === 0 && (
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

        {items.map((item) => (
          <div key={item.id} className="feed-item">
            <div className="feed-item-meta">
              <span className="feed-item-source">{item.feeds?.name || domain(item.url)}</span>
              <span className="feed-item-sep">·</span>
              <span className="feed-item-age">{timeAgo(item.published_at) || '—'}</span>
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
