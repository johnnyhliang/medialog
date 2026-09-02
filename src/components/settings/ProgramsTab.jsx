import { useEffect, useState, useCallback } from 'react'
import { listPrograms, setProgramWindowOpen, setProgramDeadline, createProgram } from '../../lib/db/programs.js'

const CATEGORIES = ['fellowship', 'program', 'cohort', 'internship', 'research']
const EMPTY_FORM = { name: '', url: '', category: 'fellowship', deadline: '', notes: '' }

// These controls save on change rather than behind a Save button, which is the
// right shape for a table of toggles and dates. What was wrong is that they
// updated local state optimistically and never checked the write: a rejected
// update left the row looking saved until a reload silently reverted it. Every
// write now reverts its own optimistic change and says so.
//
// The queries live in src/lib/db/programs.js and THROW on failure, so the
// revert is driven by a catch rather than by remembering to check `error` —
// forgetting a catch fails loudly, forgetting an `if (error)` fails silently,
// and silent is the bug this tab had.
export default function ProgramsTab({ supabase, addToast = () => {} }) {
  const [programs, setPrograms] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setPrograms(await listPrograms(supabase))
    } catch (e) {
      // Swallowed here rather than rethrown: `load` is also the revert path, and
      // an unhandled rejection inside a revert would replace a visible failure
      // with an invisible one.
      addToast(`Couldn’t load programs: ${e.message}`, 'error')
    }
    setLoading(false)
    // addToast is deliberately not a dependency: it is only read on the failure
    // path, and listing it would re-run the load on every render where the
    // parent hands down a fresh closure — a query storm in exchange for a
    // dependency that can never change what the load does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => { load() }, [load])

  // On failure, reload rather than restoring a remembered value. Editing a date
  // fires a change per keystroke, so each call would capture the *previous
  // optimistic* value as its rollback target and undo only the last keystroke.
  // Re-reading is the only thing that reliably makes the UI match the database.
  async function revert(error) {
    addToast(`Couldn’t save: ${error.message}`, 'error')
    await load()
  }

  async function toggleWindow(id, current) {
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, window_open: !current } : p))
    try {
      await setProgramWindowOpen(supabase, id, !current)
    } catch (e) {
      await revert(e)
    }
  }

  async function updateDeadline(id, deadline) {
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, deadline: deadline || null } : p))
    try {
      await setProgramDeadline(supabase, id, deadline)
    } catch (e) {
      await revert(e)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    let created
    try {
      created = await createProgram(supabase, form)
    } catch (err) {
      // Keep the form open and populated on failure — clearing it discards what
      // the user typed for a program that was never actually created.
      addToast(`Couldn’t add program: ${err.message}`, 'error')
      return
    }
    if (!created) {
      addToast('Couldn’t add program: unknown error', 'error')
      return
    }
    setPrograms((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(EMPTY_FORM)
    setShowAdd(false)
  }

  if (loading) return <p className="kw-empty">Loading…</p>

  return (
    <div>
      <table className="settings-programs-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Deadline</th>
            <th>Window</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => (
            <tr key={p.id}>
              <td>
                <a href={p.url} target="_blank" rel="noreferrer" className="settings-program-name">{p.name}</a>
              </td>
              <td style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>{p.category}</td>
              <td className="settings-program-deadline">
                <input
                  type="date"
                  value={p.deadline?.slice(0, 10) ?? ''}
                  onChange={(e) => updateDeadline(p.id, e.target.value)}
                />
              </td>
              <td>
                <button
                  className={`settings-open-badge ${p.window_open ? 'open' : 'closed'}`}
                  onClick={() => toggleWindow(p.id, p.window_open)}
                >
                  {p.window_open ? 'open' : 'closed'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAdd ? (
        <form className="settings-add-form" onSubmit={handleAdd} style={{ marginTop: 16 }}>
          <div>
            <label>Name</label>
            <input placeholder="Program name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label>URL</label>
            <input placeholder="URL" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} required />
          </div>
          <div>
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>Deadline</label>
            <input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          </div>
          {/* `notes` was in the form state and the insert but had no input, so it
              was written as null every time. */}
          <div>
            <label>Notes</label>
            <input placeholder="Optional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <button type="submit">Save</button>
          <button type="button" onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)' }}>Cancel</button>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--muted)', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '6px 14px', cursor: 'pointer', width: '100%' }}
        >
          + add program
        </button>
      )}
    </div>
  )
}
