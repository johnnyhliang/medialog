import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const STATUSES = ['', 'backlog', 'active', 'done']

export default function EntryCard({ entry, onDelete, onStatusChange }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer">
          {entry.title || entry.url}
        </a>
      )}
      {entry.note && (
        <div className="note">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.note}</ReactMarkdown>
        </div>
      )}
      {entry.tags && entry.tags.length > 0 && (
        <div>
          {entry.tags.map((t) => (
            <span key={t} style={{ marginRight: 6, fontSize: 12, opacity: 0.7 }}>#{t}</span>
          ))}
        </div>
      )}
      <select
        value={entry.status || ''}
        onChange={(e) => onStatusChange(entry.id, e.target.value || null)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s === '' ? 'no status' : s}</option>
        ))}
      </select>
      <button onClick={() => onDelete(entry.id)} aria-label="delete">🗑</button>
    </div>
  )
}
