import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { relatedTo } from '../lib/db/retrieval.js'

// On-demand only. Entry cards render in lists, so fetching on mount would fire
// one RPC per visible card; the user asks for related items explicitly.
export default function RelatedEntries({ supabase, entryId, onOpen }) {
  const [items, setItems] = useState(null) // null = not fetched yet
  const [busy, setBusy] = useState(false)

  async function load(e) {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      setItems(await relatedTo(supabase, { entryId, topK: 5 }))
    } catch {
      setItems([])
    }
    setBusy(false)
  }

  return (
    <div className="rel-wrap" onClick={(e) => e.stopPropagation()}>
      {items === null ? (
        <button className="rel-btn" onClick={load} disabled={busy}>
          <Link2 size={12} /> {busy ? 'finding…' : 'related'}
        </button>
      ) : items.length === 0 ? (
        <p className="rel-empty muted">nothing related yet</p>
      ) : (
        <ul className="rel-list">
          {items.map((it) => (
            <li key={it.entryId}>
              <button className="rel-item" onClick={() => onOpen?.(it.entryId)}>
                {it.heading && <span className="rel-heading">{it.heading} · </span>}
                {it.content.length > 160 ? `${it.content.slice(0, 160).trimEnd()}…` : it.content}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
