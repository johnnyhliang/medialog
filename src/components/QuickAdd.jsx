import { useState } from 'react'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function QuickAdd({ onAdd, disabled, onCheckDuplicate }) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [dupWarning, setDupWarning] = useState(null)
  const [showNudge, setShowNudge] = useState(false)

  async function handleUrlBlur() {
    const u = url.trim()
    if (!u || !onCheckDuplicate) { setDupWarning(null); return }
    const dup = await onCheckDuplicate(u)
    setDupWarning(dup || null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const u = url.trim()
    const n = note.trim()
    if (!u && !n) return
    if (u && !n) setShowNudge(true)
    else setShowNudge(false)
    setDupWarning(null)
    await onAdd({ url: u || null, note: n })
    setUrl('')
    setNote('')
  }

  return (
    <form className="quickadd" onSubmit={handleSubmit}>
      <input
        placeholder="Paste a link (optional)"
        maxLength={2000}
        value={url}
        onChange={(e) => { setUrl(e.target.value); setDupWarning(null) }}
        onBlur={handleUrlBlur}
      />
      {dupWarning && (
        <p className="quickadd-dup-warning">
          You saved this on {formatDate(dupWarning.created_at)} in <strong>{dupWarning.topic_name}</strong>.{' '}
          <button type="button" className="link-btn" onClick={() => setDupWarning(null)}>Dismiss</button>
        </p>
      )}
      <textarea
        placeholder="What's worth remembering about this?"
        maxLength={10000}
        rows={2}
        value={note}
        onChange={(e) => { setNote(e.target.value); if (e.target.value) setShowNudge(false) }}
      />
      {showNudge && (
        <p className="quickadd-nudge">No notes yet — why does this matter?</p>
      )}
      <div className="quickadd-row">
        <button type="submit" disabled={disabled}>Save</button>
      </div>
    </form>
  )
}
