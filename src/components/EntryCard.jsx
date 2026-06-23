import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ChevronUp, Clock, MoreVertical, Pencil, Pin, PinOff, Plus, Trash2, Archive } from 'lucide-react'
import WaybackPopup from './WaybackPopup.jsx'
import TagInput from './TagInput.jsx'
import MarkdownView from './MarkdownView.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import Modal from './Modal.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { snoozeEntry, unsnoozeEntry } from '../lib/db/entries.js'
import { fetchTitle } from '../lib/enrich.js'
import { getYouTubeThumbnail } from '../lib/youtube.js'
import { classifyUrl } from '../lib/classifyUrl.js'

const NoteEditor = lazy(() => import('./NoteEditor.jsx'))

function faviconUrl(url) {
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`
  } catch { return null }
}

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

function daysOld(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function EntryCard({ entry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onNoteVersion, onShowHistory, onTitleChange, moveTargets, onMove, tagColors, onEntryUpdate, supabase: supabaseClient, focused, forceExpand, onForceExpandDone }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.note || '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(entry.title || '')
  const [urlDraft, setUrlDraft] = useState(entry.url || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [expanded, setExpanded] = useState(false)
  const [showSheet, setShowSheet] = useState(false)

  useEffect(() => {
    if (forceExpand) {
      setExpanded(true)
      onForceExpandDone?.()
    }
  }, [forceExpand])
  const [showSecondaryActions, setShowSecondaryActions] = useState(false)
  const [takeawayPrompt, setTakeawayPrompt] = useState(false)
  const [takeaway, setTakeaway] = useState('')
  const [fetchingTitle, setFetchingTitle] = useState(false)
  const [showWayback, setShowWayback] = useState(false)
  const [showSnoozePicker, setShowSnoozePicker] = useState(false)
  const timer = useRef(null)
  const statusClass = entry.status ? `status-${entry.status}` : 'status-backlog'
  const thumb = getYouTubeThumbnail(entry.url)
  const fileType = classifyUrl(entry.url)
  const age = relativeAge(entry.created_at)
  const days = daysOld(entry.created_at)
  const noNoteAged = !entry.note && days >= 14

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
        setSaveStatus('failed')
      }
    }, 800)
    return () => clearTimeout(timer.current)
  }, [draft, editing])

  async function finishEditing() {
    if (timer.current) clearTimeout(timer.current)
    try {
      await onNoteSave(entry.id, draft)
      onNoteVersion?.(entry.id, draft) // commit a version snapshot on Done
      setEditing(false)
    } catch {
      setSaveStatus('failed')
      // keep editing open so the user sees the failure
    }
  }

  function saveTitle() {
    const t = titleDraft.trim()
    const u = urlDraft.trim()
    const titleChanged = t !== (entry.title || '')
    const urlChanged = u !== (entry.url || '')
    if (titleChanged || urlChanged) {
      if (urlChanged) {
        onTitleChange?.(entry.id, t || entry.title || '', u)
      } else {
        onTitleChange?.(entry.id, t || entry.title || '')
      }
    }
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
    // Use sheet on mobile OR on narrow grid cells (≤320px wide) so content isn't crammed
    if (window.innerWidth <= 640 || e.currentTarget.offsetWidth <= 320) {
      setShowSheet(true)
    } else {
      setExpanded((prev) => !prev)
    }
  }

  function handleStatusSelect(e) {
    const status = e.target.value || null
    if (status === 'done' && !entry.note) {
      setTakeawayPrompt(true)
    } else {
      onStatusChange(entry.id, status)
    }
  }

  function handleTakeawaySave() {
    if (takeaway.trim()) onNoteSave(entry.id, takeaway.trim())
    onStatusChange(entry.id, 'done')
    setTakeawayPrompt(false)
    setTakeaway('')
  }

  function handleTakeawaySkip() {
    onStatusChange(entry.id, 'done')
    setTakeawayPrompt(false)
  }

  function handleMove(e) {
    const topicId = e.target.value
    if (!topicId) return
    e.target.value = ''
    onMove?.(entry.id, topicId)
  }

  async function handleSnooze(dateStr) {
    const client = supabaseClient || supabase
    await snoozeEntry(client, entry.id, dateStr + 'T00:00:00Z')
    onEntryUpdate?.({ ...entry, surface_after: dateStr + 'T00:00:00Z' })
    setShowSnoozePicker(false)
    setShowSecondaryActions(false)
  }

  async function handleUnsnooze() {
    const client = supabaseClient || supabase
    await unsnoozeEntry(client, entry.id)
    onEntryUpdate?.({ ...entry, surface_after: null })
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
      {/* Collapse handle — only shown in inline-expanded state, not in sheet */}
      <div className="card-collapse-row">
        <button
          className="icon-btn card-collapse-btn"
          aria-label="Collapse card"
          onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
        >
          <ChevronUp size={15} />
        </button>
      </div>

      {/* Title + URL block */}
      <div className="card-title-row">
        {editingTitle ? (
          <div className="card-title-edit-form" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                className="card-title-input"
                aria-label="edit title"
                placeholder="Title"
                value={titleDraft}
                style={{ flex: 1 }}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
                  if (e.key === 'Escape') { setTitleDraft(entry.title || ''); setUrlDraft(entry.url || ''); setEditingTitle(false) }
                }}
                autoFocus
              />
              {(urlDraft || entry.url) && (
                <button
                  type="button"
                  className="btn-small btn-ghost"
                  title="Fill with page title"
                  disabled={fetchingTitle}
                  onClick={async () => {
                    const u = urlDraft || entry.url
                    if (!u) return
                    setFetchingTitle(true)
                    const t = await fetchTitle(supabase, u)
                    if (t) setTitleDraft(t)
                    setFetchingTitle(false)
                  }}
                >
                  {fetchingTitle ? '…' : '↓ title'}
                </button>
              )}
            </div>
            <input
              className="card-url-input"
              aria-label="edit url"
              placeholder="URL (optional)"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
                if (e.key === 'Escape') { setTitleDraft(entry.title || ''); setUrlDraft(entry.url || ''); setEditingTitle(false) }
              }}
            />
            <div className="card-title-edit-btns">
              <button className="btn-small" onClick={saveTitle}>Save</button>
              <button className="btn-small btn-ghost" onClick={() => { setTitleDraft(entry.title || ''); setUrlDraft(entry.url || ''); setEditingTitle(false) }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="card-title-display">
            {entry.url
              ? (
                <a href={entry.url} className="card-title" target="_blank" rel="noreferrer">
                  {faviconUrl(entry.url) && (
                    <img
                      src={faviconUrl(entry.url)}
                      alt=""
                      width={14}
                      height={14}
                      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 5, borderRadius: 2, flexShrink: 0 }}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                  {entry.title || entry.url}
                </a>
              )
              : <span className="card-title">{entry.title || <em className="muted">Untitled</em>}</span>
            }
            <button
              className="icon-btn card-title-edit-btn"
              aria-label="edit title"
              title="Edit title / URL"
              onClick={(e) => { e.stopPropagation(); setTitleDraft(entry.title || ''); setUrlDraft(entry.url || ''); setEditingTitle(true) }}
            >
              <Pencil size={12} />
            </button>
            {fileType && onPreview && (
              <button className="preview-btn" onClick={(e) => { e.stopPropagation(); onPreview(entry.url) }}>
                {previewLabel(entry.url)}
              </button>
            )}
          </div>
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
        <div onClick={(e) => e.stopPropagation()}>
          <Suspense fallback={<p className="muted">Loading editor…</p>}>
            <NoteEditor value={draft} onChange={setDraft} supabase={supabase} />
          </Suspense>
        </div>
      ) : entry.note ? (
        <div onClick={(e) => { if (e.target.type !== 'checkbox') { e.stopPropagation(); startEditing() } }} style={{ cursor: 'text' }}>
          <MarkdownView onPreview={onPreview} onToggleCheckbox={handleCheckboxToggle}>{entry.note}</MarkdownView>
        </div>
      ) : (
        <button className="card-add-note-btn" onClick={(e) => { e.stopPropagation(); startEditing() }}>
          <Plus size={13} />
          Add a note
        </button>
      )}

      {/* Tags row */}
      <div className="card-tags-row">
        <TagInput value={entry.tags || []} onChange={(next) => onTagsChange(entry.id, next)} tagColors={tagColors} />
      </div>

      {takeawayPrompt && (
        <div className="takeaway-prompt" onClick={(e) => e.stopPropagation()}>
          <p className="takeaway-prompt-label">Any final takeaway to add?</p>
          <textarea
            className="takeaway-input"
            placeholder="What did you learn?"
            rows={2}
            value={takeaway}
            onChange={(e) => setTakeaway(e.target.value)}
            autoFocus
          />
          <div className="takeaway-actions">
            <button className="btn-small" onClick={handleTakeawaySave}>Save &amp; Done</button>
            <button className="btn-small btn-ghost" onClick={handleTakeawaySkip}>Skip</button>
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="card-actions-bar">
        <select
          className={`status-select ${statusClass}`}
          value={entry.status || ''}
          onChange={handleStatusSelect}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === '' ? '—' : s}</option>
          ))}
        </select>

        {age && <span className="card-age">{age}</span>}

        {entry.surface_after && (
          <button
            className="snooze-indicator"
            onClick={(e) => { e.stopPropagation(); handleUnsnooze() }}
            title={`Snoozed until ${new Date(entry.surface_after).toLocaleDateString()} — click to unsnooze`}
          >
            <Clock size={12} />
            <span>{new Date(entry.surface_after).toLocaleDateString()}</span>
          </button>
        )}

        <div className="card-actions-right">
          {/* Secondary actions */}
          <div className="card-secondary-actions" style={{ display: showSecondaryActions ? 'flex' : undefined, gap: 'inherit' }}>
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
            {entry.url && (
              <button
                className="icon-btn"
                aria-label="archive to Wayback Machine"
                title="Wayback Machine"
                onClick={(e) => { e.stopPropagation(); setShowWayback(true) }}
              >
                <Archive size={15} />
              </button>
            )}
            {moveSelect}
            <button
              className="icon-btn"
              aria-label="snooze"
              title="Snooze"
              onClick={(e) => { e.stopPropagation(); setShowSnoozePicker(p => !p) }}
            >
              <Clock size={15} />
            </button>
          </div>

          {showSnoozePicker && (
            <div className="snooze-picker" onClick={(e) => e.stopPropagation()}>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => { if (e.target.value) handleSnooze(e.target.value) }}
                autoFocus
                onBlur={() => setShowSnoozePicker(false)}
              />
            </div>
          )}

          <button
            className="card-overflow-btn"
            onClick={() => setShowSecondaryActions(p => !p)}
            aria-label="More actions"
            style={{ color: showSecondaryActions ? 'var(--text)' : undefined }}
          >
            <MoreVertical size={15} />
          </button>

          {editing ? (
            <>
              {saveStatus === 'saving' && <span className="save-status">Saving…</span>}
              {saveStatus === 'saved' && <span className="save-status">Saved</span>}
              {saveStatus === 'failed' && <span className="save-status save-status--failed">Save failed</span>}
              <button className="btn-small" onClick={finishEditing}>Done</button>
            </>
          ) : (
            <button className="icon-btn" aria-label="edit note" onClick={startEditing}>
              <Pencil size={15} />
            </button>
          )}

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

  const ogImage = entry.og_image || (thumb ? null : null) // YouTube thumb handled separately below
  const previewImage = thumb || entry.og_image || null
  const domain = (() => { try { return new URL(entry.url).hostname.replace(/^www\./, '') } catch { return null } })()

  const collapsedBody = (
    <div className="card-collapsed-inner">
      {previewImage && (
        <img
          src={previewImage}
          alt=""
          className="card-thumb-inline"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      )}
      <div className="card-collapsed-content">
        {entry.url ? (
          <a
            href={entry.url}
            className="card-title card-title--collapsed"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {entry.title || entry.url}
          </a>
        ) : (
          <span className="card-title card-title--collapsed">
            {entry.title || <em className="muted">Untitled</em>}
          </span>
        )}
        {domain && (
          <div className="card-domain-row">
            <img
              src={faviconUrl(entry.url)}
              alt=""
              width={12}
              height={12}
              style={{ borderRadius: 2, flexShrink: 0 }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <span className="card-domain">{domain}</span>
            {entry.status && (
              <span className={`status-dot dot-${entry.status}`} title={entry.status} style={{ marginLeft: 'auto' }} />
            )}
          </div>
        )}
        {entry.note && (
          <p className="card-preview-note">{entry.note.replace(/[#*`[\]]/g, '').slice(0, 200)}</p>
        )}
        {!entry.note && (entry.og_description) && (
          <p className="card-preview-note card-og-desc">{entry.og_description.slice(0, 160)}</p>
        )}
        {noNoteAged && (
          <span className="card-no-note-chip">no notes · {days}d</span>
        )}
        <div className="card-compact-meta">
          {!domain && entry.status && (
            <span className={`status-dot dot-${entry.status}`} title={entry.status} />
          )}
          {(entry.tags || []).map((t) => (
            <span
              key={t}
              style={{
                opacity: 0.85,
                background: tagColors?.[t] || 'transparent',
                padding: tagColors?.[t] ? '1px 5px' : undefined,
                borderRadius: tagColors?.[t] ? '4px' : undefined,
              }}
            >#{t}</span>
          ))}
          {age && <span style={{ marginLeft: 'auto' }}>{age}</span>}
          {entry.surface_after && (
            <button
              className="snooze-indicator"
              onClick={(e) => { e.stopPropagation(); handleUnsnooze() }}
              title={`Snoozed until ${new Date(entry.surface_after).toLocaleDateString()} — click to unsnooze`}
            >
              <Clock size={12} />
              <span>{new Date(entry.surface_after).toLocaleDateString()}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div
        className={`card ${entry.status ? `card-status-${entry.status}` : 'card-status-backlog'}${entry.pinned ? ' pinned' : ''}${expanded ? '' : ' card-collapsed'}${noNoteAged ? ' card-aged-no-note' : ''}${focused ? ' entry-card--focused' : ''}`}
        id={`entry-${entry.id}`}
        onClick={handleCardClick}
      >
        {expanded ? expandedBody : collapsedBody}
      </div>

      {showSheet && (
        <Modal onClose={() => setShowSheet(false)} label={entry.title || 'Entry'}>
          <div style={{ padding: '4px 0' }}>
            {expandedBody}
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          message="Move this entry to trash?"
          confirmLabel="Move to Trash"
          onConfirm={() => { setConfirmDelete(false); onDelete(entry.id); setShowSheet(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {showWayback && (
        <WaybackPopup
          entry={entry}
          supabase={supabaseClient || supabase}
          onClose={() => setShowWayback(false)}
          onEntryUpdate={(updated) => { onEntryUpdate?.(updated); setShowWayback(false) }}
        />
      )}
    </>
  )
}
