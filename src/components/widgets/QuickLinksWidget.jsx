import { useCallback, useEffect, useState } from 'react'
import { listQuickLinks, createQuickLink, updateQuickLink, deleteQuickLink } from '../../lib/db/quickLinks.js'

const normalizeUrl = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

export default function QuickLinksWidget({ supabase }) {
  const [links, setLinks] = useState([])
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState({ label: '', url: '', note: '' })
  // Three states, not two (REFACTOR.md §4.4): a shelf that failed to load must
  // never render as "no tools yet — hit edit to add one", which is an invitation
  // to re-add links that already exist.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) return
    setError(null)
    try {
      setLinks(await listQuickLinks(supabase))
    } catch (e) {
      setError(e.message || 'could not load your links')
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Matches note as well as label — the point of the shelf is finding a tool by
  // what it does when its name has slipped your mind.
  const q = query.trim().toLowerCase()
  const shown = q
    ? links.filter((l) => `${l.label} ${l.note ?? ''}`.toLowerCase().includes(q))
    : links

  // Reload rather than restore a remembered value — the same reason CompaniesTab
  // and ProgramsTab do (docs/tech-debt.md #5): the label/url/note inputs fire a
  // write per keystroke, so each call's "previous value" is the *previous
  // optimistic* one and rolling back to it undoes exactly one character. Only
  // re-reading makes the shelf match the database.
  async function revert(e, verb = 'save') {
    // Reload first, then set the message: `load` clears `error` on the way in,
    // so setting it beforehand would have it wiped by the reload it triggers.
    await load()
    setError(`couldn’t ${verb} that link: ${e.message}`)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!draft.label.trim() || !draft.url.trim()) return
    setError(null)
    try {
      // Await before touching state: an add is one deliberate click, so there is
      // no typing latency to hide and nothing is gained by guessing.
      const row = await createQuickLink(supabase, {
        label: draft.label.trim(),
        url: normalizeUrl(draft.url.trim()),
        note: draft.note.trim() || null,
        position: links.length,
      })
      setLinks((prev) => [...prev, row])
      // The draft is only cleared on success, so a failed add leaves what you
      // typed in the form to retry instead of making you type it again.
      setDraft({ label: '', url: '', note: '' })
    } catch (err) {
      setError(`couldn’t add that link: ${err.message}`)
    }
  }

  async function handleEdit(id, patch) {
    // This one stays optimistic: it runs on every keystroke, and awaiting the
    // round trip before updating state would make the input drop characters.
    setError(null)
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    try {
      await updateQuickLink(supabase, id, patch)
    } catch (e) {
      await revert(e)
    }
  }

  async function handleDelete(id) {
    setError(null)
    try {
      await deleteQuickLink(supabase, id)
      setLinks((prev) => prev.filter((l) => l.id !== id))
    } catch (e) {
      await revert(e, 'remove')
    }
  }

  return (
    <div className="kw-links">
      <div className="kw-links-head">
        <p className="kw-label kw-label--inline">tools &amp; links</p>
        <button className="kw-links-edit" onClick={() => setEditing(!editing)}>
          {editing ? 'done' : 'edit'}
        </button>
      </div>

      {/* `explore-semantic-error` rather than a new class: FilesView already
          reuses it for its archive failures, so it is the app's existing
          inline-error style and not an ExploreView-private one. */}
      {error && <p className="explore-semantic-error">{error}</p>}

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
          {shown.length === 0 && !error && (
            <p className="kw-links-empty">
              {loading ? 'loading…' : links.length === 0 ? 'no tools yet — hit edit to add one' : 'nothing matches'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
