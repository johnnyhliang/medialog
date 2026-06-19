// src/components/TopicsGrid.jsx
export default function TopicsGrid({ topics, onSelectTopic }) {
  const sorted = [...topics].sort((a, b) => a.name.localeCompare(b.name))

  if (sorted.length === 0) {
    return <p className="muted topics-grid-empty">No topics yet — create one in the sidebar</p>
  }

  return (
    <div className="topics-grid">
      {sorted.map((t) => (
        <button key={t.id} className="topics-grid-card" onClick={() => onSelectTopic(t)}>
          <span className="topics-grid-name">{t.name}</span>
        </button>
      ))}
    </div>
  )
}
