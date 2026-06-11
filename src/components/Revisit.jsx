import { useState } from 'react'

export default function Revisit({ entries, onSeen }) {
  const [index, setIndex] = useState(0)
  const current = entries[index]

  if (!current) return <p>Nothing to revisit right now. 🌱</p>

  async function handleSeen() {
    await onSeen(current.id)
    setIndex((i) => i + 1)
  }

  return (
    <div>
      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
        {current.url && <a href={current.url} target="_blank" rel="noreferrer">{current.title || current.url}</a>}
        {current.note && <p style={{ whiteSpace: 'pre-wrap' }}>{current.note}</p>}
      </div>
      <button onClick={handleSeen}>Seen — next</button>
    </div>
  )
}
