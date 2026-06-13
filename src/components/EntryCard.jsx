import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TagInput from './TagInput.jsx'

const STATUSES = ['', 'backlog', 'active', 'done']

export default function EntryCard({ entry, onDelete, onStatusChange, onTagsChange }) {
  const statusClass = entry.status ? `status-${entry.status}` : 'status-backlog'
  return (
    <div className="card">
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
      <div className="card-meta">
        <TagInput
          value={entry.tags || []}
          onChange={(next) => onTagsChange(entry.id, next)}
        />
        <div className="card-actions">
          <select
            className={`status-select ${statusClass}`}
            value={entry.status || ''}
            onChange={(e) => onStatusChange(entry.id, e.target.value || null)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === '' ? 'no status' : s}</option>
            ))}
          </select>
          <button className="icon-btn" onClick={() => onDelete(entry.id)} aria-label="delete">🗑</button>
        </div>
      </div>
    </div>
  )
}
