import { useState } from 'react'

export default function QuickAdd({ onAdd, disabled }) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const u = url.trim()
    const n = note.trim()
    if (!u && !n) return
    await onAdd({ url: u || null, note: n })
    setUrl('')
    setNote('')
  }

  return (
    <form className="quickadd" onSubmit={handleSubmit}>
      <input placeholder="link (optional)" maxLength={2000} value={url} onChange={(e) => setUrl(e.target.value)} />
      <textarea placeholder="note / takeaway" maxLength={10000} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="quickadd-row">
        <button type="submit" disabled={disabled}>Save</button>
      </div>
    </form>
  )
}
