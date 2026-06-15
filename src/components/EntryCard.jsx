import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TagInput from './TagInput.jsx'

// CodeMirror is heavy and only needed while editing — load it on demand.
const NoteEditor = lazy(() => import('./NoteEditor.jsx'))
const STATUSES = ['', 'backlog', 'active', 'done']
const mdComponents = {
  a: ({ node, ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
}

export default function EntryCard({
  entry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onNoteVersion, onShowHistory,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.note || '')
  const timer = useRef(null)
  const statusClass = entry.status ? `status-${entry.status}` : 'status-backlog'

  // Debounced autosave while editing (note update only — no version).
  useEffect(() => {
    if (!editing) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onNoteSave(entry.id, draft), 800)
    return () => clearTimeout(timer.current)
  }, [draft, editing])

  function finishEditing() {
    if (timer.current) clearTimeout(timer.current)
    onNoteSave(entry.id, draft)
    onNoteVersion(entry.id, draft) // commit a version snapshot
    setEditing(false)
  }

  return (
    <div className={`card${entry.pinned ? ' pinned' : ''}`} id={`entry-${entry.id}`}>
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer">{entry.title || entry.url}</a>
      )}

      {editing ? (
        <div className="editor-split">
          <Suspense fallback={<p className="muted">Loading editor…</p>}>
            <NoteEditor value={draft} onChange={setDraft} />
          </Suspense>
          <div className="note preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{draft}</ReactMarkdown>
          </div>
        </div>
      ) : (
        entry.note && (
          <div className="note">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{entry.note}</ReactMarkdown>
          </div>
        )
      )}

      <div className="card-meta">
        <TagInput value={entry.tags || []} onChange={(next) => onTagsChange(entry.id, next)} />
        <div className="card-actions">
          <button className="icon-btn" aria-label={entry.pinned ? 'unpin' : 'pin'} onClick={() => onTogglePin(entry.id, !entry.pinned)}>
            {entry.pinned ? '★' : '☆'}
          </button>
          <button className="icon-btn" aria-label="history" onClick={() => onShowHistory(entry.id)}>🕘</button>
          {editing ? (
            <button onClick={finishEditing}>Done</button>
          ) : (
            <button className="icon-btn" aria-label="edit" onClick={() => { setDraft(entry.note || ''); setEditing(true) }}>✎</button>
          )}
          <select
            className={`status-select ${statusClass}`}
            value={entry.status || ''}
            onChange={(e) => onStatusChange(entry.id, e.target.value || null)}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s === '' ? 'no status' : s}</option>)}
          </select>
          <button className="icon-btn" onClick={() => onDelete(entry.id)} aria-label="delete">🗑</button>
        </div>
      </div>
    </div>
  )
}
