import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const COLORS = ['yellow', 'green', 'blue', 'pink']

function applyHighlights(text, highlights) {
  if (!highlights.length) return [{ type: 'text', value: text }]

  const sorted = [...highlights].sort((a, b) => {
    const ia = text.indexOf(a.text)
    const ib = text.indexOf(b.text)
    return ia - ib
  })

  const parts = []
  let cursor = 0
  for (const hl of sorted) {
    const idx = text.indexOf(hl.text, cursor)
    if (idx === -1) continue
    if (idx > cursor) parts.push({ type: 'text', value: text.slice(cursor, idx) })
    parts.push({ type: 'highlight', value: hl.text, color: hl.color, id: hl.id, note: hl.note })
    cursor = idx + hl.text.length
  }
  if (cursor < text.length) parts.push({ type: 'text', value: text.slice(cursor) })
  return parts
}

function HighlightedText({ text, highlights, onHighlight }) {
  const parts = applyHighlights(text, highlights)
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'highlight' ? (
          <mark
            key={i}
            className={`reader-highlight reader-highlight--${p.color}`}
            title={p.note || undefined}
          >
            {p.value}
          </mark>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </>
  )
}

export default function ReaderModal({ entry, onClose }) {
  const overlayRef = useRef(null)
  const [highlights, setHighlights] = useState([])
  const [pendingSelection, setPendingSelection] = useState(null)
  const [pickerPos, setPickerPos] = useState(null)
  const [pendingNote, setPendingNote] = useState('')
  const [pendingColor, setPendingColor] = useState('yellow')
  const pickerRef = useRef(null)

  useEffect(() => {
    supabase
      .from('highlights')
      .select('*')
      .eq('entry_id', entry.id)
      .order('created_at')
      .then(({ data }) => setHighlights(data ?? []))
  }, [entry.id])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (pendingSelection) { setPendingSelection(null); setPickerPos(null) }
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, pendingSelection])

  function onOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  const handleMouseUp = useCallback((e) => {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (!text || text.length < 3) return
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    setPendingSelection(text)
    setPickerPos({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX })
    setPendingNote('')
    setPendingColor('yellow')
  }, [])

  async function saveHighlight() {
    if (!pendingSelection) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('highlights').insert({
      user_id: user.id,
      entry_id: entry.id,
      text: pendingSelection,
      color: pendingColor,
      note: pendingNote.trim() || null,
    }).select().single()
    if (!error && data) {
      setHighlights((prev) => [...prev, data])
    }
    setPendingSelection(null)
    setPickerPos(null)
    window.getSelection()?.removeAllRanges()
  }

  async function deleteHighlight(id) {
    await supabase.from('highlights').delete().eq('id', id)
    setHighlights((prev) => prev.filter((h) => h.id !== id))
  }

  const paragraphs = (entry.full_text || '').split(/\n{2,}/)

  return (
    <div className="reader-overlay" ref={overlayRef} onClick={onOverlayClick}>
      <div className="reader-modal">
        <div className="reader-header">
          <div className="reader-title">{entry.title || entry.url}</div>
          <div className="reader-header-actions">
            {entry.url && (
              <a href={entry.url} target="_blank" rel="noreferrer" className="reader-orig-link">
                View original ↗
              </a>
            )}
            <button className="reader-close" onClick={onClose} aria-label="Close reader">✕</button>
          </div>
        </div>

        <div className="reader-body" onMouseUp={handleMouseUp}>
          {paragraphs.map((p, i) => (
            <p key={i}>
              <HighlightedText text={p.trim()} highlights={highlights} />
            </p>
          ))}
        </div>

        {highlights.length > 0 && (
          <div className="reader-highlights-panel">
            <div className="reader-highlights-label">Highlights</div>
            {highlights.map((h) => (
              <div key={h.id} className={`reader-hl-row reader-hl-row--${h.color}`}>
                <span className="reader-hl-text">{h.text.slice(0, 120)}{h.text.length > 120 ? '…' : ''}</span>
                {h.note && <span className="reader-hl-note">{h.note}</span>}
                <button className="reader-hl-del" onClick={() => deleteHighlight(h.id)} aria-label="remove highlight">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickerPos && pendingSelection && (
        <div
          className="reader-picker"
          ref={pickerRef}
          style={{ top: pickerPos.top, left: Math.min(pickerPos.left, window.innerWidth - 280) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="reader-picker-colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`reader-color-btn reader-color-btn--${c}${pendingColor === c ? ' active' : ''}`}
                onClick={() => setPendingColor(c)}
                aria-label={c}
              />
            ))}
          </div>
          <input
            className="reader-picker-note"
            placeholder="Add a note… (optional)"
            value={pendingNote}
            onChange={(e) => setPendingNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveHighlight() }}
          />
          <div className="reader-picker-actions">
            <button className="reader-picker-save" onClick={saveHighlight}>Highlight</button>
            <button className="reader-picker-cancel" onClick={() => { setPendingSelection(null); setPickerPos(null); window.getSelection()?.removeAllRanges() }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
