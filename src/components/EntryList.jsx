import { useState } from 'react'
import { supabase as supabaseClient } from '../lib/supabaseClient.js'
import EntryCard from './EntryCard.jsx'
import EmptyState from './EmptyState.jsx'

const PAGE_SIZE = 50

export default function EntryList({ entries, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onNoteVersion, onShowHistory, onTitleChange, moveTargets, onMove, tagColors, onEntryUpdate }) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  if (entries.length === 0) return <EmptyState message="No entries yet." />

  const visible = entries.slice(0, limit)
  const remaining = entries.length - visible.length

  return (
    <div>
      <div className="entry-list-grid">
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
            onTitleChange={onTitleChange}
            moveTargets={moveTargets}
            onMove={onMove}
            tagColors={tagColors}
            onEntryUpdate={onEntryUpdate}
            supabase={supabaseClient}
          />
        ))}
      </div>
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
