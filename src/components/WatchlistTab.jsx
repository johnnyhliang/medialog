import { useEffect, useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import {
  listWatchlistPrograms as listPrograms,
  createWatchlistProgram as createProgram,
  deleteProgram,
} from '../lib/db/programs.js'

function formatOpensAt(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function StatusBadge({ program }) {
  if (program.window_open) return <span className="watchlist-badge watchlist-badge--open">open</span>
  if (program.opens_at) {
    const isPast = program.opens_at < new Date().toISOString().split('T')[0]
    if (isPast) return <span className="watchlist-badge watchlist-badge--unknown">closed</span>
    return <span className="watchlist-badge watchlist-badge--scheduled">Opens {formatOpensAt(program.opens_at)}</span>
  }
  return <span className="watchlist-badge watchlist-badge--unknown">unknown</span>
}

export default function WatchlistTab({ supabase }) {
  const [programs, setPrograms] = useState([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', notes: '', opens_at: '' })
  const [loading, setLoading] = useState(true)
  // Rendered inline rather than toasted: CareerView does not pass this tab an
  // addToast, and a failure that shows as an empty watchlist is the exact lie
  // the db layer exists to stop.
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPrograms(await listPrograms(supabase))
      setError(null)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.url.trim()) return
    try {
      const row = await createProgram(supabase, form)
      setPrograms((prev) => [...prev, row])
    } catch (e) {
      setError(e.message)
      return
    }
    setForm({ name: '', url: '', notes: '', opens_at: '' })
    setShowAdd(false)
  }

  async function handleDelete(id) {
    // The row is dropped locally only if the database says it actually went.
    // `programs` still has no DELETE policy (see deleteProgram), so a blocked
    // delete returns success with zero rows — the old code removed the row
    // regardless and it came back on the next reload, with nothing in between
    // to suggest the removal had not happened.
    try {
      const deleted = await deleteProgram(supabase, id)
      if (!deleted.length) { setError('Could not remove that program.'); return }
      setPrograms((prev) => prev.filter((p) => p.id !== id))
      setError(null)
    } catch (e) {
      setError(e.message)
    }
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

      {error && <p className="muted" style={{ fontSize: 'var(--text-sm)', color: 'var(--danger)' }}>{error}</p>}

      {loading && <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>Loading…</p>}

      {!loading && sorted.length === 0 && (
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
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
