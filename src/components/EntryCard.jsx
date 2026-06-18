import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Clock, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import TagInput from './TagInput.jsx'
import MarkdownView from './MarkdownView.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import Modal from './Modal.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { getYouTubeThumbnail } from '../lib/youtube.js'
import { classifyUrl } from '../lib/classifyUrl.js'

const NoteEditor = lazy(() => import('./NoteEditor.jsx'))

function previewLabel(url) {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean).pop()
    return seg ? decodeURIComponent(seg) : 'Preview'
  } catch {
    return 'Preview'
  }
}

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

export default function EntryCard({ entry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onNoteVersion, onShowHistory, onTitleChange, moveTargets, onMove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.note || '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(entry.title || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [expanded, setExpanded] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const timer = useRef(null)
  const statusClass = entry.status ? `status-${entry.status}` : 'status-backlog'
  const thumb = getYouTubeThumbnail(entry.url)
  const fileType = classifyUrl(entry.url)
  const age = relativeAge(entry.created_at)

  useEffect(() => {
    if (!editing) return
    if (timer.current) clearTimeout(timer.current)
    setSaveStatus('saving')
    timer.current = setTimeout(async () => {
      try {
        await onNoteSave(entry.id, draft)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 1500)
      } catch {
        setSaveStatus('idle')
      }
    }, 800)
    return () => clearTimeout(timer.current)
  }, [draft, editing])

  function finishEditing() {
    if (timer.current) clearTimeout(timer.current)
    onNoteSave(entry.id, draft)
    onNoteVersion?.(entry.id, draft) // commit a version snapshot on Done
    setEditing(false)
  }

  function saveTitle() {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== entry.title) onTitleChange?.(entry.id, trimmed)
    setEditingTitle(false)
  }

  function startEditing() {
    setDraft(entry.note || '')
    setEditing(true)
  }

  function handleCheckboxToggle(index) {
    let count = 0
    const updated = (entry.note || '').replace(/\[( |x)\]/gi, (match) => {
      if (count++ === index) return match === '[ ]' ? '[x]' : '[ ]'
      return match
    })
    onNoteSave(entry.id, updated)
  }

  function handleCardClick(e) {
    if (e.target.closest('a, button, input, select')) return
    if (window.innerWidth <= 640) {
      setShowSheet(true)
    } else {
      setExpanded((prev) => !prev)
    }
  }

  function handleMove(e) {
    const topicId = e.target.value
    if (!topicId) return
    e.target.value = ''
    onMove?.(entry.id, topicId)
  }

  const moveSelect = moveTargets?.length > 0 && (
    <select className="move-select" value="" onChange={handleMove}>
      <option value="" disabled>Move to…</option>
      {moveTargets.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )

  const expandedBody = (
    <>
      {/* Title / URL */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        {editingTitle ? (
          <input
            className="card-title-input"
            aria-label="edit title"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
              if (e.key === 'Escape') { setTitleDraft(entry.title || ''); setEditingTitle(false) }
            }}
            autoFocus
          />
        ) : entry.url ? (
          <a
            href={entry.url}
            className="card-title"
            target="_blank"
            rel="noreferrer"
            onDoubleClick={(e) => { e.preventDefault(); setTitleDraft(entry.title || ''); setEditingTitle(true) }}
          >
            {entry.title || entry.url}
          </a>
        ) : (
          <span
            className="card-title"
            onClick={() => { setTitleDraft(entry.title || ''); setEditingTitle(true) }}
            style={{ cursor: 'text' }}
          >
            {entry.title || <em className="muted">Untitled</em>}
          </span>
        )}
        {!editingTitle && fileType && onPreview && (
          <button className="preview-btn" onClick={() => onPreview(entry.url)}>
            {previewLabel(entry.url)}
          </button>
        )}
      </div>

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
        <div onClick={(e) => { if (e.target.type !== 'checkbox') startEditing() }} style={{ cursor: 'text' }}>
          <MarkdownView onPreview={onPreview} onToggleCheckbox={handleCheckboxToggle}>{entry.note}</MarkdownView>
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
          <button
            className="icon-btn"
            aria-label={entry.pinned ? 'unpin' : 'pin'}
            onClick={() => onTogglePin(entry.id, !entry.pinned)}
          >
            {entry.pinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
          {onShowHistory && (
            <button className="icon-btn" aria-label="history" onClick={() => onShowHistory(entry.id)}>
              <Clock size={15} />
            </button>
          )}
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {saveStatus === 'saving' && <span className="save-status">Saving…</span>}
              {saveStatus === 'saved' && <span className="save-status">Saved ·</span>}
              <button onClick={finishEditing}>Done</button>
            </div>
          ) : (
            <button className="icon-btn" aria-label="edit" onClick={startEditing}>
              <Pencil size={15} />
            </button>
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
          {moveSelect}
          <button
            className="icon-btn icon-btn-danger"
            onClick={() => setConfirmDelete(true)}
            aria-label="delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </>
  )

  const collapsedBody = (
    <>
      {thumb && (
        <img
          src={thumb}
          alt=""
          className="card-thumb"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      )}
      {entry.url ? (
        <a
          href={entry.url}
          className="card-title"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {entry.title || entry.url}
        </a>
      ) : (
        <span className="card-title" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {entry.title || <em className="muted">Untitled</em>}
        </span>
      )}
      {entry.note && (
        <p className="card-preview-note">{entry.note.replace(/[#*`[\]]/g, '').slice(0, 120)}</p>
      )}
      <div className="card-compact-meta">
        {entry.status && (
          <span className={`status-dot dot-${entry.status}`} title={entry.status} />
        )}
        {(entry.tags || []).map((t) => (
          <span key={t} style={{ opacity: 0.7 }}>#{t}</span>
        ))}
        {age && <span style={{ marginLeft: 'auto' }}>{age}</span>}
      </div>
    </>
  )

  return (
    <>
      <div
        className={`card${entry.pinned ? ' pinned' : ''}${expanded ? '' : ' card-collapsed'}`}
        id={`entry-${entry.id}`}
        onClick={expanded ? undefined : handleCardClick}
      >
        {expanded ? expandedBody : collapsedBody}

        {confirmDelete && (
          <ConfirmModal
            message="Move this entry to trash?"
            confirmLabel="Move to Trash"
            onConfirm={() => { setConfirmDelete(false); onDelete(entry.id) }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </div>

      {showSheet && (
        <Modal onClose={() => setShowSheet(false)} label={entry.title || 'Entry'}>
          <div style={{ padding: '4px 0' }}>
            {expandedBody}
            {confirmDelete && (
              <ConfirmModal
                message="Move this entry to trash?"
                confirmLabel="Move to Trash"
                onConfirm={() => { setConfirmDelete(false); onDelete(entry.id); setShowSheet(false) }}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
