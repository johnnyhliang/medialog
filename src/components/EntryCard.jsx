import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import TagInput from './TagInput.jsx'
import MarkdownView from './MarkdownView.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { getYouTubeThumbnail } from '../lib/youtube.js'

const NoteEditor = lazy(() => import('./NoteEditor.jsx'))

const STATUSES = ['', 'backlog', 'active', 'done']

function relativeAge(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d < 1) return 'today'
  if (d === 1) return '1 day ago'
  if (d < 7) return `${d} days ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

export default function EntryCard({ entry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.note || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const timer = useRef(null)
  const statusClass = entry.status ? `status-${entry.status}` : 'status-backlog'
  const thumb = getYouTubeThumbnail(entry.url)
  const age = relativeAge(entry.created_at)

  useEffect(() => {
    if (!editing) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onNoteSave(entry.id, draft), 800)
    return () => clearTimeout(timer.current)
  }, [draft, editing])

  function finishEditing() {
    if (timer.current) clearTimeout(timer.current)
    onNoteSave(entry.id, draft)
    setEditing(false)
  }

  function startEditing() {
    setDraft(entry.note || '')
    setEditing(true)
  }

  return (
    <div className={`card${entry.pinned ? ' pinned' : ''}`} id={`entry-${entry.id}`}>
      {/* Title / URL */}
      {entry.url ? (
        <a href={entry.url} className="card-title" target="_blank" rel="noreferrer">
          {entry.title || entry.url}
        </a>
      ) : entry.title ? (
        <span className="card-title">{entry.title}</span>
      ) : null}

      {/* YouTube thumbnail */}
      {thumb && !editing && (
        <img
          src={thumb}
          alt=""
          className="card-thumb"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      )}

      {/* Note or editor */}
      {editing ? (
        <Suspense fallback={<p className="muted">Loading editor…</p>}>
          <NoteEditor value={draft} onChange={setDraft} supabase={supabase} />
        </Suspense>
      ) : entry.note ? (
        <div onClick={startEditing} style={{ cursor: 'text' }}>
          <MarkdownView>{entry.note}</MarkdownView>
        </div>
      ) : (
        <span className="card-no-note" onClick={startEditing}>
          Add a thought — why did you save this?
        </span>
      )}

      {/* Meta row */}
      <div className="card-meta">
        <TagInput value={entry.tags || []} onChange={(next) => onTagsChange(entry.id, next)} />
        {age && <span className="card-age">{age}</span>}
        <div className="card-actions">
          <button className="icon-btn" aria-label={entry.pinned ? 'unpin' : 'pin'} onClick={() => onTogglePin(entry.id, !entry.pinned)}>
            {entry.pinned ? '★' : '☆'}
          </button>
          {editing ? (
            <button onClick={finishEditing}>Done</button>
          ) : (
            <button className="icon-btn" aria-label="edit" onClick={startEditing}>✎</button>
          )}
          <select
            className={`status-select ${statusClass}`}
            value={entry.status || ''}
            onChange={(e) => onStatusChange(entry.id, e.target.value || null)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === '' ? 'no status' : s}</option>
            ))}
          </select>
          <button className="icon-btn" onClick={() => setConfirmDelete(true)} aria-label="delete">🗑</button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          message="Move this entry to trash?"
          confirmLabel="Move to Trash"
          onConfirm={() => { setConfirmDelete(false); onDelete(entry.id) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
