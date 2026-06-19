import { useState } from 'react'
import { listArchivedEntriesByTopic } from '../lib/db/entries.js'

export default function ArchiveSection({ topicId, supabase, onStatusChange, onDelete }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(null)

  async function load() {
    setLoading(true)
    const data = await listArchivedEntriesByTopic(supabase, topicId)
    setEntries(data)
    setCount(data.length)
    setLoading(false)
    setOpen(true)
  }

  if (!open) {
    return (
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button
          className="load-more-btn"
          onClick={load}
          disabled={loading}
          style={{ opacity: 0.7 }}
        >
          {loading ? 'Loading…' : `Show archived entries${count !== null ? ` (${count})` : ''}`}
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <p className="section-label" style={{ margin: 0 }}>Archived ({entries.length})</p>
        <button
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={() => setOpen(false)}
        >Hide</button>
      </div>
      {entries.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No archived entries.</p>}
      {entries.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
          <span style={{ flex: 1 }}>{e.title || e.url || 'Untitled'}</span>
          <button style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => { onStatusChange(e.id, 'backlog'); setEntries(prev => prev.filter(x => x.id !== e.id)) }}>Unarchive</button>
          <button style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)' }} onClick={() => { onDelete(e.id); setEntries(prev => prev.filter(x => x.id !== e.id)) }}>Delete</button>
        </div>
      ))}
    </div>
  )
}
