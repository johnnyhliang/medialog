import { useState, useRef, useEffect } from 'react'
import { fetchTitle } from '../lib/enrich.js'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function QuickAdd({ onAdd, disabled, onCheckDuplicate, supabase }) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [dupWarning, setDupWarning] = useState(null)
  const [showNudge, setShowNudge] = useState(false)
  const [fetchedTitle, setFetchedTitle] = useState(null)
  const [fetchingTitle, setFetchingTitle] = useState(false)
  const [conversationMode, setConversationMode] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [note])

  async function handleUrlBlur() {
    const u = url.trim()
    if (!u) { setDupWarning(null); setFetchedTitle(null); return }
    // Dup check
    if (onCheckDuplicate) {
      try { setDupWarning(await onCheckDuplicate(u) || null) } catch { setDupWarning(null) }
    }
    // Title prefetch
    if (supabase && !fetchedTitle) {
      setFetchingTitle(true)
      const title = await fetchTitle(supabase, u)
      setFetchedTitle(title || null)
      setFetchingTitle(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const u = url.trim()
    const n = note.replace(/^\n+|\n+$/g, '').trim()
    if (!u && !n) return
    if (u && !n) setShowNudge(true)
    else setShowNudge(false)
    setDupWarning(null)
    const tags = conversationMode ? ['ai-chat'] : []
    await onAdd({ url: u || null, note: n, title: fetchedTitle || undefined, tags })
    setUrl('')
    setNote('')
    setFetchedTitle(null)
    setConversationMode(false)
  }

  return (
    <form className="quickadd" onSubmit={handleSubmit}>
      <input
        placeholder="Paste a link (optional)"
        maxLength={2000}
        value={url}
        onChange={(e) => { setUrl(e.target.value); setDupWarning(null); setFetchedTitle(null) }}
        onBlur={handleUrlBlur}
      />
      {fetchingTitle && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', margin: '2px 0 0' }}>fetching title…</p>}
      {fetchedTitle && !fetchingTitle && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--done)' }}>✓</span> {fetchedTitle}
        </p>
      )}
      {dupWarning && (
        <p className="quickadd-dup-warning">
          You saved this on {formatDate(dupWarning.created_at)} in <strong>{dupWarning.topic_name}</strong>.{' '}
          <button type="button" className="link-btn" onClick={() => setDupWarning(null)}>Dismiss</button>
        </p>
      )}
      <textarea
        ref={textareaRef}
        placeholder={conversationMode ? "Paste conversation here…" : "What's worth remembering about this?"}
        maxLength={10000}
        rows={conversationMode ? 8 : 2}
        style={{ resize: 'none', overflow: 'hidden', ...(conversationMode && { minHeight: '180px' }) }}
        value={note}
        onChange={(e) => { setNote(e.target.value); if (e.target.value) setShowNudge(false) }}
      />
      {showNudge && (
        <p className="quickadd-nudge">No notes yet — why does this matter?</p>
      )}
      <div className="quickadd-row">
        <button type="button" className={`toggle-btn${conversationMode ? ' active' : ''}`} onClick={() => setConversationMode(!conversationMode)}>Conversation</button>
        <button type="submit" disabled={disabled}>Save</button>
      </div>
    </form>
  )
}
