export default function EntryCard({ entry, onDelete }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer">
          {entry.title || entry.url}
        </a>
      )}
      {entry.note && <p style={{ whiteSpace: 'pre-wrap' }}>{entry.note}</p>}
      <button onClick={() => onDelete(entry.id)} aria-label="delete">🗑</button>
    </div>
  )
}
