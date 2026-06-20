import { useEffect, useState, useCallback } from 'react'

const STATUSES = ['saved', 'applied', 'screen', 'interview', 'offer', 'rejected', 'ghosted']
const STATUS_NEXT = {
  saved: 'applied', applied: 'screen', screen: 'interview',
  interview: 'offer', offer: 'offer', rejected: 'rejected', ghosted: 'ghosted',
}
const STATUS_LABELS = {
  saved: 'Saved', applied: 'Applied', screen: 'Screen',
  interview: 'Interview', offer: 'Offer', rejected: 'Rejected', ghosted: 'Ghosted',
}

export default function ApplicationsView({ supabase, prefill, onClearPrefill }) {
  const [apps, setApps] = useState([])
  const [statusFilter, setStatusFilter] = useState('applied')
  const [showAdd, setShowAdd] = useState(!!prefill)
  const [form, setForm] = useState({
    company: prefill?.company ?? '',
    role: prefill?.title ?? '',
    url: prefill?.url ?? '',
    status: 'applied',
    applied_at: '',
    deadline: '',
    notes: '',
    opportunity_id: prefill?.id ?? null,
  })
  const [expandedNotes, setExpandedNotes] = useState(new Set())
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('applications')
      .select('*')
      .order('updated_at', { ascending: false })
    if (data) setApps(data)
  }, [supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (prefill) {
      setForm((f) => ({
        ...f,
        company: prefill.company ?? '',
        role: prefill.title ?? '',
        url: prefill.url ?? '',
        opportunity_id: prefill.id,
      }))
      setShowAdd(true)
    }
  }, [prefill])

  async function handleAdd(e) {
    e.preventDefault()
    const { data } = await supabase
      .from('applications')
      .insert({ ...form, applied_at: form.applied_at || null, deadline: form.deadline || null })
      .select()
      .single()
    if (data) { setApps((prev) => [data, ...prev]); setShowAdd(false); onClearPrefill?.() }
  }

  async function cycleStatus(id, current) {
    const next = STATUS_NEXT[current]
    if (next === current) return
    const now = new Date().toISOString()
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, status: next, updated_at: now } : a))
    await supabase.from('applications').update({ status: next, updated_at: now }).eq('id', id)
  }

  async function updateNotes(id, notes) {
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, notes } : a))
    await supabase.from('applications').update({ notes, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function deleteApp(id) {
    setApps((prev) => prev.filter((a) => a.id !== id))
    await supabase.from('applications').delete().eq('id', id)
    setConfirmDelete(null)
  }

  function toggleNotes(id) {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: apps.filter((a) => a.status === s).length }), {})
  const visible = apps.filter((a) => a.status === statusFilter)

  return (
    <div className="apps-view">
      <div className="apps-header">
        <h2 className="apps-title">Applications</h2>
        <button className="apps-add-btn" onClick={() => setShowAdd((v) => !v)}>+ add</button>
      </div>

      {showAdd && (
        <form className="apps-form" onSubmit={handleAdd}>
          <div className="apps-form-row">
            <input placeholder="Company" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} required />
            <input placeholder="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} required />
          </div>
          <div className="apps-form-row">
            <input placeholder="URL (optional)" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="apps-form-row">
            <input type="date" value={form.applied_at} onChange={(e) => setForm((f) => ({ ...f, applied_at: e.target.value }))} />
            <input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <button type="submit">Save</button>
        </form>
      )}

      <div className="apps-tabs">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`apps-tab ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABELS[s]}{counts[s] > 0 ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      <div className="apps-list">
        {visible.length === 0 && <p className="apps-empty">Nothing here yet.</p>}
        {visible.map((app) => (
          <div key={app.id} className="apps-card">
            <div className="apps-card-top">
              <div className="apps-card-info">
                <span className="apps-company">{app.company}</span>
                <span className="apps-role">{app.role}</span>
                {app.url && <a href={app.url} target="_blank" rel="noreferrer" className="apps-link">↗</a>}
              </div>
              <div className="apps-card-meta">
                {app.applied_at && (
                  <span className="apps-date">
                    Applied {new Date(app.applied_at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {app.deadline && (
                  <span className="apps-deadline">
                    · Deadline {new Date(app.deadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <div className="apps-card-actions">
                <button
                  className={`apps-status-badge apps-status-${app.status}`}
                  onClick={() => cycleStatus(app.id, app.status)}
                >
                  {STATUS_LABELS[app.status]}
                </button>
                <button className="apps-notes-toggle" onClick={() => toggleNotes(app.id)}>notes ▾</button>
                <button className="apps-delete" onClick={() => setConfirmDelete(app.id)}>×</button>
              </div>
            </div>
            {expandedNotes.has(app.id) && (
              <textarea
                className="apps-notes"
                value={app.notes ?? ''}
                placeholder="Add notes…"
                onChange={(e) => updateNotes(app.id, e.target.value)}
              />
            )}
            {confirmDelete === app.id && (
              <div className="apps-confirm">
                <span>Delete this application?</span>
                <button onClick={() => deleteApp(app.id)}>Yes, delete</button>
                <button onClick={() => setConfirmDelete(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
