import { useState } from 'react'
import { Trash2 } from 'lucide-react'

export default function SortInbox({ entries, topics, onAssign, onDelete }) {
  const [index, setIndex] = useState(0)
  const [target, setTarget] = useState('')

  const current = entries[index]
  const destinations = topics.filter((t) => t.name !== 'Inbox')

  if (!current) return <p>Inbox is clear. 🎉</p>

  async function handleAssign() {
    if (!target) return
    await onAssign(current.id, target)
    setTarget('')
    setIndex((i) => i + 1)
  }

  async function handleDelete() {
    await onDelete(current.id)
    setIndex((i) => i + 1)
  }

  return (
    <div>
      <p className="section-label">{entries.length - index} left in Inbox</p>
      <div className="card">
        {current.url && <a href={current.url} target="_blank" rel="noreferrer">{current.title || current.url}</a>}
        {current.note && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{current.note}</p>}
        <div className="card-meta">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose topic…</option>
            {destinations.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button onClick={handleAssign}>Assign</button>
          <button className="btn-small btn-danger" onClick={handleDelete} aria-label="delete">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}
