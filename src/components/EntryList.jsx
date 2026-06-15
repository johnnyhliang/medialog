import EntryCard from './EntryCard.jsx'

export default function EntryList({
  entries, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onNoteVersion, onShowHistory,
}) {
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
          onNoteVersion={onNoteVersion}
          onShowHistory={onShowHistory}
        />
      ))}
    </div>
  )
}
