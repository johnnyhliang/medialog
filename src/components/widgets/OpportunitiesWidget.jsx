import { useEffect, useState, useCallback } from 'react'
import useCurrentTime, { minutesSince } from '../../hooks/useCurrentTime.js'
import {
  OppRow,
  fetchOpportunities,
  interleaved,
  matchesFilter,
  opportunityMutations,
} from '../../lib/opportunities.jsx'
import { createManualOpportunity } from '../../lib/db/opportunities.js'

const FILTERS = ['All', 'SWE', 'Quant', 'Fellowship', 'HN', 'Twitter', 'Saved']

export default function OpportunitiesWidget({ supabase, onTrack }) {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addTag, setAddTag] = useState('swe')
  const [showMore, setShowMore] = useState(false)
  const [lastChecked, setLastChecked] = useState(null)
  const [loading, setLoading] = useState(true)

  const now = useCurrentTime()

  const load = useCallback(async () => {
    const merged = await fetchOpportunities(supabase, 100)
    if (merged) setItems(merged)
    setLastChecked(new Date())
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const { markRead, toggleSaved } = opportunityMutations(supabase, items, setItems)

  async function handleManualAdd(e) {
    e.preventDefault()
    if (!addUrl.trim()) return
    try {
      const row = await createManualOpportunity(supabase, { url: addUrl, note: addNote, tag: addTag })
      setItems((prev) => [row, ...prev])
    } catch { /* the box keeps what was typed so it can be retried */ return }
    setAddUrl(''); setAddNote(''); setShowAdd(false)
  }

  const filtered = items.filter((i) => matchesFilter(i, filter))

  const unread = filtered.filter((i) => !i.is_read)
  const read = filtered.filter((i) => i.is_read && !i.is_saved)
  const visible = showMore ? filtered : (filter === 'All' ? interleaved(unread).slice(0, 20) : unread.slice(0, 20))
  const minutesAgo = minutesSince(lastChecked, now)

  return (
    <div className="opp-widget">
      <div className="opp-header">
        <span className="kw-label">
          opportunities
          {unread.length > 0 && <span className="opp-badge">{unread.length} new</span>}
        </span>
        <button className="opp-add-btn" onClick={() => setShowAdd((v) => !v)}>+ add</button>
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
            placeholder="Note (optional)"
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

      {loading && <p className="kw-empty">loading…</p>}
      {!loading && visible.length === 0 && (
        <p className="kw-empty">
          No new opportunities{minutesAgo !== null ? ` · checked ${minutesAgo}m ago` : ''}
        </p>
      )}

      <div className="opp-rows">
        {visible.map((item) => (
          <OppRow
            key={item.id}
            item={item}
            onRead={markRead}
            onSave={toggleSaved}
            onTrack={onTrack}
          />
        ))}
      </div>

      {!showMore && read.length > 0 && (
        <button className="opp-load-more" onClick={() => setShowMore(true)}>
          load more ({read.length})
        </button>
      )}
    </div>
  )
}
