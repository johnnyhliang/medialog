import { useState } from 'react'
import ConfirmModal from './ConfirmModal.jsx'
import EmptyState from './EmptyState.jsx'

export default function TrashView({ entries, deletedTopics = [], onRestore, onRestoreTopic, onEmptyTrash }) {
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const totalItems = entries.length + deletedTopics.length

  if (!totalItems) return <EmptyState message="Trash is empty." />

  return (
    <div className="trash-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <p className="section-label" style={{ margin: 0 }}>{totalItems} item{totalItems !== 1 ? 's' : ''} in trash</p>
        <button className="btn-danger" onClick={() => setConfirmEmpty(true)}>Empty Trash</button>
      </div>

      {deletedTopics.length > 0 && (
        <div className="trash-topics-section">
          <p className="section-label" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Topics</p>
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

      {entries.length > 0 && (
        <>
          {deletedTopics.length > 0 && (
            <p className="section-label" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Entries</p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="card">
              <div className="card-body">
                {entry.url && (
                  <a href={entry.url} target="_blank" rel="noreferrer" className="card-title">
                    {entry.title || entry.url}
                  </a>
                )}
                {entry.note && (
                  <p className="note" style={{ margin: '0.5rem 0' }}>
                    {entry.note.slice(0, 300)}{entry.note.length > 300 ? '…' : ''}
                  </p>
                )}
              </div>
              <div className="card-meta">
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  Deleted {new Date(entry.deleted_at).toLocaleDateString()}
                </span>
                <div className="card-actions">
                  <button onClick={() => onRestore(entry.id)}>Restore</button>
                </div>
              </div>
            </div>
          ))}
        </>
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
