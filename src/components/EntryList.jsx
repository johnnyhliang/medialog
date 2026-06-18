import EntryCard from './EntryCard.jsx'

export default function EntryList({ entries, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onNoteVersion, onShowHistory }) {
  if (entries.length === 0) return <p>No entries yet.</p>
  return (
    <div>
      {entries.map((e) => (
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
    </div>
  )
}
