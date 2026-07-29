import { useEffect, useState } from 'react'
import { listQuickLinks, createQuickLink, updateQuickLink, deleteQuickLink } from '../../lib/db/quickLinks.js'

const normalizeUrl = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

export default function QuickLinksWidget({ supabase }) {
  const [links, setLinks] = useState([])
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState({ label: '', url: '', note: '' })

  useEffect(() => {
    if (!supabase) return
    listQuickLinks(supabase).then(setLinks).catch(() => setLinks([]))
  }, [supabase])

  // Matches note as well as label — the point of the shelf is finding a tool by
  // what it does when its name has slipped your mind.
  const q = query.trim().toLowerCase()
  const shown = q
    ? links.filter((l) => `${l.label} ${l.note ?? ''}`.toLowerCase().includes(q))
    : links

  async function handleAdd(e) {
    e.preventDefault()
    if (!draft.label.trim() || !draft.url.trim()) return
    const row = await createQuickLink(supabase, {
      label: draft.label.trim(),
      url: normalizeUrl(draft.url.trim()),
      note: draft.note.trim() || null,
      position: links.length,
    })
    setLinks([...links, row])
    setDraft({ label: '', url: '', note: '' })
  }

  async function handleEdit(id, patch) {
    setLinks(links.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    await updateQuickLink(supabase, id, patch)
  }

  async function handleDelete(id) {
    setLinks(links.filter((l) => l.id !== id))
    await deleteQuickLink(supabase, id)
  }

  return (
    <div className="kw-links">
      <div className="kw-links-head">
        <p className="kw-label kw-label--inline">tools &amp; links</p>
        <button className="kw-links-edit" onClick={() => setEditing(!editing)}>
          {editing ? 'done' : 'edit'}
        </button>
      </div>

      {links.length > 4 && !editing && (
        <input
          className="kw-links-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="what does it do?"
          aria-label="search tools"
        />
      )}

      {editing ? (
        <div className="kw-links-editor">
          {links.map((l) => (
            <div key={l.id} className="kw-links-edit-row">
              <input
                value={l.label}
                onChange={(e) => handleEdit(l.id, { label: e.target.value })}
                aria-label={`label for ${l.label}`}
              />
              <input
                value={l.url}
                onChange={(e) => handleEdit(l.id, { url: e.target.value })}
                aria-label={`url for ${l.label}`}
              />
              <input
                value={l.note ?? ''}
                onChange={(e) => handleEdit(l.id, { note: e.target.value })}
                placeholder="what it's for"
                aria-label={`note for ${l.label}`}
              />
              <button onClick={() => handleDelete(l.id)} aria-label={`remove ${l.label}`}>×</button>
            </div>
          ))}
          <form className="kw-links-add" onSubmit={handleAdd}>
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="name"
              aria-label="new link name"
            />
            <input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="url"
              aria-label="new link url"
            />
            <input
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="what it's for"
              aria-label="new link note"
            />
            <button type="submit">add</button>
          </form>
        </div>
      ) : (
        <div className="kw-rows">
          {shown.map((l) => (
            <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="kw-link-row">
              <span className="kw-dot">•</span>
              <span className="kw-link-text">
                <span>{l.label}</span>
                {l.note && <span className="kw-link-note">{l.note}</span>}
              </span>
            </a>
          ))}
          {shown.length === 0 && (
            <p className="kw-links-empty">
              {links.length === 0 ? 'no tools yet — hit edit to add one' : 'nothing matches'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
