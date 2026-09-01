import { useEffect, useState, useCallback } from 'react'
import { readPref, writePref } from '../lib/localPref.js'
import useCurrentTime, { minutesSince } from '../hooks/useCurrentTime.js'
import {
  OppRow,
  fetchOpportunities,
  interleaved,
  matchesFilter,
  opportunityMutations,
} from '../lib/opportunities.jsx'

const FILTERS = ['All', 'SWE', 'Quant', 'PM', 'Fellowship', 'Saved', 'Unread']

export default function OpportunityView({ supabase, onTrack, onUnreadCount }) {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addTag, setAddTag] = useState('swe')
  const [showRead, setShowRead] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState(null)

  const now = useCurrentTime()

  const load = useCallback(async () => {
    setLoading(true)
    const merged = await fetchOpportunities(supabase, 300)
    if (merged) {
      setItems(merged)
      onUnreadCount?.(merged.filter((i) => !i.is_read).length)
    }
    setLastChecked(new Date())
    setLoading(false)
  }, [supabase])

  // Server-side refresh of the shared opportunities table (GitHub/HN scrape),
  // then reload. Throttled to once per 8h across visits via localStorage so
  // opening the tab doesn't hammer the scraper.
  const REFRESH_KEY = 'medialog_opps_last_fetch'
  const REFRESH_MS = 8 * 60 * 60 * 1000

  const refreshFromSource = useCallback(async (force = false) => {
    if (refreshing) return
    if (!force) {
      const last = Number(readPref(REFRESH_KEY, 0))
      if (Date.now() - last < REFRESH_MS) return
    }
    setRefreshing(true)
    try {
      const { error } = await supabase.functions.invoke('fetch-opportunities')
      if (!error) {
        // Unguarded, a throw here skipped the load() below, so a successful
        // scrape rendered no new items at all.
        writePref(REFRESH_KEY, Date.now())
        await load()
      }
    } catch { /* leave existing items in place */ }
    setRefreshing(false)
  }, [supabase, refreshing, load])

  useEffect(() => { load().then(() => refreshFromSource(false)) }, [load])

  const { markRead, markAllRead, toggleSaved } = opportunityMutations(supabase, items, setItems)

  async function handleManualAdd(e) {
    e.preventDefault()
    if (!addUrl.trim()) return
    const hostname = (() => { try { return new URL(addUrl).hostname } catch { return addUrl } })()
    const { data } = await supabase
      .from('opportunities')
      .insert({
        source: 'manual',
        title: hostname,
        body: addNote || null,
        url: addUrl.trim(),
        tags: [addTag],
        posted_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (data) setItems((prev) => [data, ...prev])
    setAddUrl(''); setAddNote(''); setShowAdd(false)
  }

  const filtered = items.filter((i) => matchesFilter(i, filter))

  const unread = filtered.filter((i) => !i.is_read)
  const read = filtered.filter((i) => i.is_read)
  const minutesAgo = minutesSince(lastChecked, now)

  const visibleUnread = interleaved(unread)
  const visibleRead = showRead ? read : []

  return (
    <div className="opp-view">
      <div className="opp-view-header">
        <div className="opp-view-title-row">
          <h2 className="opp-view-title">
            Opportunities
            {unread.length > 0 && <span className="opp-badge">{unread.length} unread</span>}
          </h2>
          <div className="opp-view-actions">
            {minutesAgo !== null && (
              <span className="opp-last-checked">checked {minutesAgo}m ago</span>
            )}
            {unread.length > 0 && (
              <button className="opp-mark-all-btn" onClick={() => markAllRead(filtered)}>
                Mark all read
              </button>
            )}
            <button className="opp-refresh-btn" onClick={() => refreshFromSource(true)} disabled={loading || refreshing}>
              {refreshing ? 'Fetching…' : loading ? 'Loading...' : 'Refresh'}
            </button>
            <button className="opp-add-btn" onClick={() => setShowAdd((v) => !v)}>+ add</button>
          </div>
        </div>

        {showAdd && (
          <form className="opp-manual-form" onSubmit={handleManualAdd}>
            <input
              placeholder="URL"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              required
            />
            <input
              placeholder="Note / location (optional)"
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
            />
            <select value={addTag} onChange={(e) => setAddTag(e.target.value)}>
              <option value="swe">SWE</option>
              <option value="quant">Quant</option>
              <option value="fellowship">Fellowship</option>
              <option value="research">Research</option>
              <option value="product">Product</option>
            </select>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setShowAdd(false)}>Cancel</button>
          </form>
        )}

        <div className="opp-filter-pills">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`opp-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="opp-view-body">
        {loading && <p className="opp-empty">Loading...</p>}

        {!loading && visibleUnread.length === 0 && (
          <p className="opp-empty">No new opportunities.</p>
        )}

        <div className="opp-rows">
          {visibleUnread.map((item) => (
            <OppRow
              key={item.id}
              item={item}
              onRead={markRead}
              onSave={toggleSaved}
              onTrack={onTrack}
            />
          ))}
        </div>

        {read.length > 0 && (
          <div className="opp-read-section">
            <button
              className="opp-read-toggle"
              onClick={() => setShowRead((v) => !v)}
            >
              {showRead ? `Hide read (${read.length})` : `Show read (${read.length})`}
            </button>
            {showRead && (
              <div className="opp-rows opp-rows-read">
                {visibleRead.map((item) => (
                  <OppRow
                    key={item.id}
                    item={item}
                    onRead={markRead}
                    onSave={toggleSaved}
                    onTrack={onTrack}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
