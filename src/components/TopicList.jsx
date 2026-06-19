import { useState } from 'react'
import { Inbox } from 'lucide-react'

export default function TopicList({ topics, selectedId, onSelect, onAdd, sidebarCollapsed }) {
  const [name, setName] = useState('')

  const inboxTopic = topics.find((t) => t.name === 'Inbox')
  const rest = topics
    .filter((t) => t.name !== 'Inbox')
    .sort((a, b) => a.name.localeCompare(b.name))

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
        {inboxTopic && (
          <li key={inboxTopic.id}>
            <button
              className={inboxTopic.id === selectedId ? 'selected topic-inbox-btn' : 'topic-inbox-btn'}
              onClick={() => onSelect(inboxTopic.id)}
              title="Inbox"
            >
              <Inbox size={14} className="topic-inbox-icon" />
              {!sidebarCollapsed && <span>{inboxTopic.name}</span>}
              {sidebarCollapsed && <span>{inboxTopic.name.slice(0, 2).toUpperCase()}</span>}
            </button>
          </li>
        )}
        {inboxTopic && rest.length > 0 && <li><hr className="topic-divider" /></li>}
        {rest.map((t) => (
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
