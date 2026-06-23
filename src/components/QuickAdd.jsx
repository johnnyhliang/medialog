import { useState, useRef, useEffect } from 'react'
import { fetchTitle } from '../lib/enrich.js'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// saveStatus: 'idle' | 'saving' | 'saved' | 'failed'
// enrichStatus: null | 'fetching-title' | 'indexing' | 'title-failed' | 'embed-failed'

export default function QuickAdd({ onAdd, disabled, onCheckDuplicate, supabase }) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [dupWarning, setDupWarning] = useState(null)
  const [showNudge, setShowNudge] = useState(false)
  const [fetchedTitle, setFetchedTitle] = useState(null)
  const [fetchingTitle, setFetchingTitle] = useState(false)
  const [conversationMode, setConversationMode] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'failed'
  const [enrichStatus, setEnrichStatus] = useState(null) // null | 'fetching-title' | 'indexing' | 'title-failed' | 'embed-failed'
  const textareaRef = useRef(null)
  const savedTimerRef = useRef(null)
  const enrichTimerRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [note])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(savedTimerRef.current)
      clearTimeout(enrichTimerRef.current)
    }
  }, [])

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

  function handleTitleStatus(status) {
    if (status === 'fetching') {
      setEnrichStatus('fetching-title')
    } else if (status === 'done') {
      setEnrichStatus('indexing')
    } else if (status === 'failed') {
      setEnrichStatus('title-failed')
      clearTimeout(enrichTimerRef.current)
      enrichTimerRef.current = setTimeout(() => setEnrichStatus(null), 3000)
    }
  }

  function handleEmbedStatus(status) {
    if (status === 'indexing') {
      // only show if title step is done (or there was no URL)
      setEnrichStatus((prev) => (prev === 'title-failed' ? prev : 'indexing'))
    } else if (status === 'done') {
      setEnrichStatus(null)
    } else if (status === 'failed') {
      setEnrichStatus('embed-failed')
      clearTimeout(enrichTimerRef.current)
      enrichTimerRef.current = setTimeout(() => setEnrichStatus(null), 3000)
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
    setSaveStatus('saving')
    setEnrichStatus(null)
    clearTimeout(savedTimerRef.current)
    clearTimeout(enrichTimerRef.current)

    const tags = conversationMode ? ['ai-chat'] : []
    const result = await onAdd({
      url: u || null,
      note: n,
      title: fetchedTitle || undefined,
      tags,
      onTitleStatus: u ? handleTitleStatus : undefined,
      onEmbedStatus: handleEmbedStatus,
    })

    if (result && result.ok === false) {
      // Core save failed — keep draft so user can retry
      setSaveStatus('failed')
      return
    }

    // Core save succeeded
    setSaveStatus('saved')
    setUrl('')
    setNote('')
    setFetchedTitle(null)
    setConversationMode(false)
    savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1500)
  }

  const isSaving = saveStatus === 'saving'
  const isSaved = saveStatus === 'saved'
  const isFailed = saveStatus === 'failed'

  let buttonLabel = 'Save'
  if (isSaving) buttonLabel = 'Saving…'
  else if (isSaved) buttonLabel = 'Saved ✓'

  let enrichMessage = null
  if (enrichStatus === 'fetching-title') enrichMessage = 'Fetching title…'
  else if (enrichStatus === 'indexing') enrichMessage = 'Indexing…'
  else if (enrichStatus === 'title-failed') enrichMessage = 'entry saved, title not fetched'
  else if (enrichStatus === 'embed-failed') enrichMessage = 'entry saved, search indexing pending'

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
        <button type="submit" disabled={disabled || isSaving}>{buttonLabel}</button>
      </div>
      {isFailed && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--error, #e53e3e)', margin: '4px 0 0' }}>
          Save failed — please try again
        </p>
      )}
      {enrichMessage && !isFailed && (
        <p style={{
          fontSize: 'var(--text-xs)',
          color: (enrichStatus === 'title-failed' || enrichStatus === 'embed-failed') ? 'var(--muted)' : 'var(--muted)',
          margin: '4px 0 0',
        }}>
          {enrichMessage}
        </p>
      )}
    </form>
  )
}
