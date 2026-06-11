import { useState } from 'react'

export default function TopicList({ topics, selectedId, onSelect, onAdd }) {
  const [name, setName] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <nav>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {topics.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => onSelect(t.id)}
              style={{ fontWeight: t.id === selectedId ? 'bold' : 'normal' }}
            >
              {t.name}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd}>
        <input
          placeholder="new topic"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </nav>
  )
}
