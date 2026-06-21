import { useEffect, useState, useCallback } from 'react'

const ATS_OPTIONS = ['greenhouse', 'lever', 'ashby']

const EMPTY_FORM = { slug: '', name: '', ats: 'greenhouse', tags: 'startup' }

export default function CompaniesTab({ supabase }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('companies').select('*').order('name')
    if (data) setRows(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function toggleEnabled(id, current) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !current } : r))
    await supabase.from('companies').update({ enabled: !current }).eq('id', id)
  }

  async function deleteRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id))
    await supabase.from('companies').delete().eq('id', id)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.slug.trim() || !form.name.trim()) return
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    const { data } = await supabase
      .from('companies')
      .insert({ slug: form.slug.trim(), name: form.name.trim(), ats: form.ats, tags, enabled: true })
      .select()
      .single()
    if (data) setRows((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
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
