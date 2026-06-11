import { useState } from 'react'

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
      <p>{entries.length - index} left in Inbox</p>
      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
        {current.url && <a href={current.url} target="_blank" rel="noreferrer">{current.title || current.url}</a>}
        {current.note && <p style={{ whiteSpace: 'pre-wrap' }}>{current.note}</p>}
      </div>
      <select value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Choose topic…</option>
        {destinations.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <button onClick={handleAssign}>Assign</button>
      <button onClick={handleDelete} aria-label="delete">Delete</button>
    </div>
  )
}
