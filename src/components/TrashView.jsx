import { useState } from 'react'
import ConfirmModal from './ConfirmModal.jsx'

export default function TrashView({ entries, onRestore, onEmptyTrash }) {
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  if (!entries.length) return <p className="muted">Trash is empty.</p>

  return (
    <div className="trash-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <p className="section-label" style={{ margin: 0 }}>{entries.length} item{entries.length !== 1 ? 's' : ''} in trash</p>
        <button className="btn-danger" onClick={() => setConfirmEmpty(true)}>Empty Trash</button>
      </div>

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
