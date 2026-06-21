import { useEffect, useState, useCallback } from 'react'
import { listFeeds, listFeedItems, dismissFeedItem, markFeedItemSaved } from '../../lib/db/feeds.js'

function formatAge(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m`
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function FeedWidget({ supabase, onSave, onGoToFeed }) {
  const [items, setItems] = useState([])
  const [hasFeeds, setHasFeeds] = useState(null) // null = loading
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const feeds = await listFeeds(supabase)
    if (!feeds.length) { setHasFeeds(false); return }
    setHasFeeds(true)
    const all = await listFeedItems(supabase, null)
    setItems(all.slice(0, 8))
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function dismiss(item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    await dismissFeedItem(supabase, item.id)
  }

  async function save(item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    await markFeedItemSaved(supabase, item.id)
    onSave?.(item)
  }

  // Still loading
  if (hasFeeds === null) return null
  // User has no feeds — don't render the widget at all
  if (!hasFeeds) return null

  return (
    <div className="fw-widget">
      <div className="fw-header">
        <span className="kw-label">latest</span>
        <button className="fw-refresh-btn" onClick={refresh} title="Refresh">
          {refreshing ? '…' : '↻'}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="kw-empty">No new items · <button className="fw-see-all" onClick={onGoToFeed}>open feed ↗</button></p>
      ) : (
        <>
          <div className="fw-rows">
            {items.map((item) => (
              <div key={item.id} className="fw-row">
                <span className="fw-source-chip" title={item.feeds?.name}>{item.feeds?.name ?? 'feed'}</span>
                <a
                  className="fw-title"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title={item.title}
                >
                  {item.title}
                </a>
                <span className="fw-age">{formatAge(item.published_at || item.fetched_at)}</span>
                <button className="fw-save-btn" onClick={() => save(item)} title="Save to MediaLog">★</button>
                <button className="fw-dismiss-btn" onClick={() => dismiss(item)} title="Dismiss">×</button>
              </div>
            ))}
          </div>
          {onGoToFeed && (
            <button className="fw-see-all" onClick={onGoToFeed}>see all in feed ↗</button>
          )}
        </>
      )}
    </div>
  )
}
