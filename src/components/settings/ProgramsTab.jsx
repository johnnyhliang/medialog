import { useEffect, useState, useCallback } from 'react'

const CATEGORIES = ['fellowship', 'program', 'cohort', 'internship', 'research']
const EMPTY_FORM = { name: '', url: '', category: 'fellowship', deadline: '', notes: '' }

export default function ProgramsTab({ supabase }) {
  const [programs, setPrograms] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('programs').select('*').order('name')
    if (data) setPrograms(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function toggleWindow(id, current) {
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, window_open: !current } : p))
    await supabase.from('programs').update({ window_open: !current }).eq('id', id)
  }

  async function updateDeadline(id, deadline) {
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, deadline: deadline || null } : p))
    await supabase.from('programs').update({ deadline: deadline || null }).eq('id', id)
  }

  async function handleAdd(e) {
    e.preventDefault()
    const { data } = await supabase
      .from('programs')
      .insert({
        name: form.name.trim(),
        url: form.url.trim(),
        category: form.category,
        deadline: form.deadline || null,
        notes: form.notes.trim() || null,
        window_open: false,
      })
      .select()
      .single()
    if (data) setPrograms((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
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
          <button type="submit">Save</button>
          <button type="button" onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)' }}>Cancel</button>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--muted)', background: 'none', border: '1px dashed var(--border)', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', width: '100%' }}
        >
          + add program
        </button>
      )}
    </div>
  )
}
