import { useMemo, useState } from 'react'
import ConfirmModal from './ConfirmModal.jsx'
import EmptyState from './EmptyState.jsx'

export default function TrashView({ entries, deletedTopics = [], topics = [], onRestore, onRestoreTopic, onEmptyTrash }) {
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [expandedTopics, setExpandedTopics] = useState(new Set())
  const totalItems = entries.length + deletedTopics.length

  const topicMap = useMemo(() => {
    const m = {}
    for (const t of topics) m[t.id] = t.name
    return m
  }, [topics])

  const groupedEntries = useMemo(() => {
    const groups = {}
    for (const e of entries) {
      const name = topicMap[e.topic_id] || 'Unknown Topic'
      if (!groups[name]) groups[name] = []
      groups[name].push(e)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [entries, topicMap])

  function toggle(name) {
    setExpandedTopics(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  if (!totalItems) return <EmptyState message="Trash is empty." />

  return (
    <div className="trash-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <p className="section-label" style={{ margin: 0 }}>{totalItems} item{totalItems !== 1 ? 's' : ''} in trash</p>
        <button className="btn-danger" onClick={() => setConfirmEmpty(true)}>Empty Trash</button>
      </div>

      {deletedTopics.length > 0 && (
        <div className="trash-topics-section">
          <p className="section-label" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Deleted Topics</p>
          {deletedTopics.map((topic) => (
            <div key={topic.id} className="trash-topic-card">
              <div>
                <div className="trash-topic-name">{topic.name}</div>
                <div className="trash-topic-meta">
                  {topic.entry_count ?? 0} entr{(topic.entry_count ?? 0) !== 1 ? 'ies' : 'y'} · Deleted {new Date(topic.deleted_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => onRestoreTopic?.(topic.id)}>Restore</button>
            </div>
          ))}
        </div>
      )}

      {groupedEntries.length > 0 && (
        <div>
          {deletedTopics.length > 0 && (
            <p className="section-label" style={{ fontSize: '0.75rem', marginBottom: '0.75rem' }}>Deleted Entries</p>
          )}
          {groupedEntries.map(([topicName, topicEntries]) => {
            const isOpen = expandedTopics.has(topicName)
            return (
              <div key={topicName} style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => toggle(topicName)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  <span style={{ flex: 1 }}>{topicName}</span>
                  <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{topicEntries.length}</span>
                  <span style={{ fontSize: 11 }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && topicEntries.map((entry) => (
                  <div key={entry.id} style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.url ? (
                        <a href={entry.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{entry.title || entry.url}</a>
                      ) : (
                        entry.title || <span className="muted">Untitled</span>
                      )}
                    </span>
                    <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>
                      {new Date(entry.deleted_at).toLocaleDateString()}
                    </span>
                    <button style={{ fontSize: 11, padding: '2px 8px', flexShrink: 0 }} onClick={() => onRestore(entry.id)}>Restore</button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {confirmEmpty && (
        <ConfirmModal
          message="Permanently delete all items in trash? This cannot be undone."
          confirmLabel="Empty Trash"
          onConfirm={() => { setConfirmEmpty(false); onEmptyTrash() }}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}
    </div>
  )
}
