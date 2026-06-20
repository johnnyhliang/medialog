import { useEffect, useState, useCallback } from 'react'

const SOURCE_COLORS = {
  twitter: 'sky',
  greenhouse: 'green',
  lever: 'green',
  ashby: 'green',
  hn: 'orange',
  github: 'purple',
  manual: 'slate',
  'program-alert': 'amber',
}

const FILTERS = ['All', 'SWE', 'Quant', 'Fellowship', 'Twitter', 'Saved']

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
      <span className="opp-age">{age}</span>
      <button
        className={`opp-save-btn ${item.is_saved ? 'saved' : ''}`}
        onClick={() => onSave(item.id, item.is_saved)}
        title="Save"
      >★</button>
      {onTrack && (
        <button className="opp-track-btn" onClick={() => onTrack(item)} title="Track">→</button>
      )}
    </div>
  )
}

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

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(100)
    if (data) setItems(data)
    setLastChecked(new Date())
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function markRead(id) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_read: true } : i))
    await supabase.from('opportunities').update({ is_read: true }).eq('id', id)
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
    if (filter === 'Twitter') return i.source === 'twitter'
    if (filter === 'SWE') return i.tags?.some((t) => ['swe', 'startup', 'big-tech'].includes(t))
    if (filter === 'Quant') return i.tags?.includes('quant')
    if (filter === 'Fellowship') return i.tags?.some((t) => ['fellowship', 'program', 'program-alert'].includes(t))
    return true
  })

  const unread = filtered.filter((i) => !i.is_read)
  const read = filtered.filter((i) => i.is_read && !i.is_saved)
  const visible = showMore ? filtered : unread.slice(0, 20)
  const minutesAgo = lastChecked ? Math.floor((Date.now() - lastChecked.getTime()) / 60000) : null

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
