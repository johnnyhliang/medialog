import { useEffect, useState, useCallback } from 'react'

const SOURCE_COLORS = {
  twitter: 'sky',
  hn: 'orange',
  github: 'purple',
  manual: 'slate',
  'program-alert': 'amber',
}

const FILTERS = ['All', 'SWE', 'Quant', 'Fellowship', 'HN', 'Twitter', 'Saved', 'Unread']

const SOURCE_PRIORITY = { 'program-alert': 0, twitter: 1, hn: 2, manual: 3, github: 4 }

function interleaved(items) {
  const buckets = {}
  for (const item of items) {
    const src = item.source
    if (!buckets[src]) buckets[src] = []
    buckets[src].push(item)
  }
  const sources = Object.keys(buckets).sort((a, b) => (SOURCE_PRIORITY[a] ?? 9) - (SOURCE_PRIORITY[b] ?? 9))
  const result = []
  let added = true
  while (added) {
    added = false
    for (const src of sources) {
      if (buckets[src].length) { result.push(buckets[src].shift()); added = true }
    }
  }
  return result
}

function formatAge(date) {
  const diff = Date.now() - date.getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m`
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function OppRow({ item, onRead, onSave, onTrack }) {
  const chipColor = SOURCE_COLORS[item.source] ?? 'slate'
  const age = item.posted_at ? formatAge(new Date(item.posted_at)) : ''
  const label = item.company ? `${item.company} — ${item.title}` : item.title

  return (
    <div className={`opp-row ${item.is_read ? 'read' : ''}`}>
      {!item.is_read && <span className="opp-dot" />}
      <span className={`opp-chip opp-chip-${chipColor}`}>{item.source}</span>
      <a
        className="opp-title"
        href={item.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => onRead(item.id)}
      >
        {label}
      </a>
      {item.body && <span className="opp-location">{item.body}</span>}
      <span className="opp-age">{age}</span>
      <button
        className={`opp-save-btn ${item.is_saved ? 'saved' : ''}`}
        onClick={() => onSave(item.id, item.is_saved)}
        title="Save"
      >★</button>
      {onTrack && (
        <button className="opp-track-btn" onClick={() => onTrack(item)} title="Track in Applications">→</button>
      )}
    </div>
  )
}

export default function OpportunityView({ supabase, onTrack }) {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addTag, setAddTag] = useState('swe')
  const [showRead, setShowRead] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(300)
    if (data) setItems(data)
    setLastChecked(new Date())
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function markRead(id) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_read: true } : i))
    await supabase.from('opportunities').update({ is_read: true }).eq('id', id)
  }

  async function markAllRead() {
    const ids = filtered.filter(i => !i.is_read).map(i => i.id)
    if (!ids.length) return
    setItems((prev) => prev.map((i) => ids.includes(i.id) ? { ...i, is_read: true } : i))
    await supabase.from('opportunities').update({ is_read: true }).in('id', ids)
  }

  async function toggleSaved(id, current) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_saved: !current } : i))
    await supabase.from('opportunities').update({ is_saved: !current }).eq('id', id)
  }

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

  const filtered = items.filter((i) => {
    if (filter === 'Saved') return i.is_saved
    if (filter === 'Unread') return !i.is_read
    if (filter === 'Twitter') return i.source === 'twitter'
    if (filter === 'HN') return i.source === 'hn'
    if (filter === 'SWE') return i.tags?.some((t) => ['swe', 'startup', 'big-tech', 'internship'].includes(t))
    if (filter === 'Quant') return i.tags?.includes('quant')
    if (filter === 'Fellowship') return i.tags?.some((t) => ['fellowship', 'program', 'program-alert'].includes(t))
    return true
  })

  const unread = filtered.filter((i) => !i.is_read)
  const read = filtered.filter((i) => i.is_read)
  const minutesAgo = lastChecked ? Math.floor((Date.now() - lastChecked.getTime()) / 60000) : null

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
              <button className="opp-mark-all-btn" onClick={markAllRead}>
                Mark all read
              </button>
            )}
            <button className="opp-refresh-btn" onClick={load} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
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
