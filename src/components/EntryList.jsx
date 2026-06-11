import EntryCard from './EntryCard.jsx'

export default function EntryList({ entries, onDelete }) {
  if (entries.length === 0) return <p>No entries yet.</p>
  return (
    <div>
      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} onDelete={onDelete} />
      ))}
    </div>
  )
}
