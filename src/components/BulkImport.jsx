import { useState } from 'react'
import { parseBulk } from '../lib/parseBulk.js'

export default function BulkImport({ onImport }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState(null)

  async function handleImport() {
    const items = parseBulk(text)
    if (items.length === 0) return
    setStatus('Importing…')
    const count = await onImport(items)
    setStatus(`Imported ${count} into Inbox.`)
    setText('')
  }

  return (
    <div>
      <textarea
        placeholder="Paste links or notes, one per line"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        style={{ width: '100%' }}
      />
      <button onClick={handleImport}>Import to Inbox</button>
      {status && <p>{status}</p>}
    </div>
  )
}
