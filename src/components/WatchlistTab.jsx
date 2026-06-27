import { useEffect, useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'

function formatOpensAt(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function StatusBadge({ program }) {
  if (program.window_open) return <span className="watchlist-badge watchlist-badge--open">open</span>
  if (program.opens_at) return <span className="watchlist-badge watchlist-badge--scheduled">Opens {formatOpensAt(program.opens_at)}</span>
  return <span className="watchlist-badge watchlist-badge--unknown">unknown</span>
}

export default function WatchlistTab({ supabase }) {
  const [programs, setPrograms] = useState([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', notes: '', opens_at: '' })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('programs')
      .select('*')
      .order('opens_at', { ascending: true, nullsFirst: false })
    if (data) setPrograms(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.url.trim()) return
    const { data } = await supabase
      .from('programs')
      .insert({
        name: form.name.trim(),
        url: form.url.trim(),
        notes: form.notes.trim() || null,
        opens_at: form.opens_at || null,
      })
      .single()
    if (data) setPrograms((prev) => [...prev, data])
    setForm({ name: '', url: '', notes: '', opens_at: '' })
    setShowAdd(false)
  }

  async function handleDelete(id) {
    await supabase.from('programs').delete().eq('id', id)
    setPrograms((prev) => prev.filter((p) => p.id !== id))
  }

  const filtered = programs.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.notes ?? '').toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    if (a.window_open && !b.window_open) return -1
    if (!a.window_open && b.window_open) return 1
    if (a.opens_at && !b.opens_at) return -1
    if (!a.opens_at && b.opens_at) return 1
    if (a.opens_at && b.opens_at) return a.opens_at.localeCompare(b.opens_at)
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="watchlist-view">
      <div className="watchlist-header">
        <input
          className="watchlist-search"
          placeholder="Search programs and notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-small" onClick={() => setShowAdd((v) => !v)}>
          <Plus size={14} /> Add
        </button>
      </div>

      {showAdd && (
        <form className="watchlist-add-form" onSubmit={handleAdd}>
          <input
            placeholder="Program name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            placeholder="URL"
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            required
          />
          <textarea
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
          <label className="watchlist-date-label">
            Expected open date (optional)
            <input
              type="date"
              value={form.opens_at}
              onChange={(e) => setForm((f) => ({ ...f, opens_at: e.target.value }))}
            />
          </label>
          <div className="watchlist-form-actions">
            <button type="submit" className="btn-small">Save</button>
            <button type="button" className="btn-small" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading && <p className="muted" style={{ fontSize: 13 }}>Loading…</p>}

      {!loading && sorted.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>
          {search ? 'No programs match that search.' : 'No programs yet. Add one to track when it opens.'}
        </p>
      )}

      <div className="watchlist-rows">
        {sorted.map((p) => (
          <div key={p.id} className="watchlist-row">
            <div className="watchlist-row-main">
              <a href={p.url} target="_blank" rel="noreferrer" className="watchlist-row-name">{p.name}</a>
              <StatusBadge program={p} />
            </div>
            {p.notes && <p className="watchlist-row-notes">{p.notes}</p>}
            <button
              className="watchlist-row-delete icon-btn"
              onClick={() => handleDelete(p.id)}
              title="Remove"
              aria-label="Remove"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
