import { useState } from 'react'
import EntryCard from './EntryCard.jsx'

const PAGE_SIZE = 50

export default function EntryList({ entries, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onNoteVersion, onShowHistory }) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  if (entries.length === 0) return <p className="muted">No entries yet.</p>

  const visible = entries.slice(0, limit)
  const remaining = entries.length - visible.length

  return (
    <div>
      {visible.map((e) => (
        <EntryCard
          key={e.id}
          entry={e}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onTagsChange={onTagsChange}
          onTogglePin={onTogglePin}
          onNoteSave={onNoteSave}
          onPreview={onPreview}
          onNoteVersion={onNoteVersion}
          onShowHistory={onShowHistory}
        />
      ))}
      {remaining > 0 && (
        <button
          className="load-more-btn"
          onClick={() => setLimit((l) => l + PAGE_SIZE)}
        >
          Show {remaining} more
        </button>
      )}
    </div>
  )
}
