import { useState } from 'react'

export default function TopicList({ topics, selectedId, onSelect, onAdd, sidebarCollapsed }) {
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
      <p className="section-label">Topics</p>
      <ul className="topics">
        {topics.map((t) => (
          <li key={t.id}>
            <button
              className={t.id === selectedId ? 'selected' : ''}
              onClick={() => onSelect(t.id)}
              title={t.name}
            >
              {sidebarCollapsed
                ? t.name.slice(0, 2).toUpperCase()
                : t.name
              }
            </button>
          </li>
        ))}
      </ul>
      <form className="topic-add" onSubmit={handleAdd}>
        <input
          placeholder="new topic"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </nav>
  )
}
