import { useEffect, useState, useCallback } from 'react'
import { listCompanies, setCompanyEnabled, deleteCompany, createCompany, parseCompanyTags } from '../../lib/db/companies.js'

const ATS_OPTIONS = ['greenhouse', 'lever', 'ashby']

const EMPTY_FORM = { slug: '', name: '', ats: 'greenhouse', tags: 'startup' }

// Saves on change, not behind a Save button. Every write reverts its own
// optimistic update on failure — see ProgramsTab for why. The queries live in
// src/lib/db/companies.js and throw, so the revert hangs off a catch rather than
// off remembering to read `error`.
export default function CompaniesTab({ supabase, addToast = () => {} }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setRows(await listCompanies(supabase))
    } catch (e) {
      // Caught, not rethrown: load is also the revert path.
      addToast(`Couldn’t load companies: ${e.message}`, 'error')
    }
    setLoading(false)
    // addToast is deliberately not a dependency: it is only read on the failure
    // path, and listing it would re-run the load on every render where the
    // parent hands down a fresh closure — a query storm in exchange for a
    // dependency that can never change what the load does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Reload rather than restore a remembered value — see ProgramsTab for why.
  async function revert(error, verb = 'save') {
    addToast(`Couldn’t ${verb}: ${error.message}`, 'error')
    await load()
  }

  async function toggleEnabled(id, current) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !current } : r))
    try {
      await setCompanyEnabled(supabase, id, !current)
    } catch (e) {
      await revert(e)
    }
  }

  async function deleteRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id))
    try {
      await deleteCompany(supabase, id)
    } catch (e) {
      await revert(e, 'delete')
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.slug.trim() || !form.name.trim()) return
    let created
    try {
      created = await createCompany(supabase, { ...form, tags: parseCompanyTags(form.tags) })
    } catch (err) {
      addToast(`Couldn’t add company: ${err.message}`, 'error')
      return
    }
    if (!created) {
      addToast('Couldn’t add company: unknown error', 'error')
      return
    }
    setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(EMPTY_FORM)
  }

  if (loading) return <p className="kw-empty">Loading…</p>

  return (
    <div>
      <table className="settings-companies-table">
        <thead>
          <tr>
            <th>On</th>
            <th>Name</th>
            <th>Slug</th>
            <th>ATS</th>
            <th>Tags</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <input
                  type="checkbox"
                  className="settings-enabled-toggle"
                  checked={r.enabled}
                  onChange={() => toggleEnabled(r.id, r.enabled)}
                />
              </td>
              <td>{r.name}</td>
              <td><span className="settings-company-slug">{r.slug}</span></td>
              <td><span className="settings-company-ats">{r.ats}</span></td>
              <td><span className="settings-company-tags">{(r.tags ?? []).join(', ')}</span></td>
              <td>
                <button className="settings-delete-btn" onClick={() => deleteRow(r.id)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="settings-add-form" onSubmit={handleAdd}>
        <div>
          <label>Slug</label>
          <input placeholder="slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
        </div>
        <div>
          <label>Display name</label>
          <input placeholder="Display name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label>ATS</label>
          <select value={form.ats} onChange={(e) => setForm((f) => ({ ...f, ats: e.target.value }))}>
            {ATS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label>Tags (comma-sep)</label>
          <input placeholder="startup,ai" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
        </div>
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
