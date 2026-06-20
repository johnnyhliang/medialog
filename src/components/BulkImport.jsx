import { useState } from 'react'
import { parseBulk } from '../lib/parseBulk.js'
import SmartImport from './SmartImport.jsx'
import ArchiveCrawl from './ArchiveCrawl.jsx'

export default function BulkImport({ onImport, onSmartImport, onArchiveImport, topics }) {
  const [tab, setTab] = useState('text')
  const [text, setText] = useState('')
  const [status, setStatus] = useState(null)

  async function handleImport() {
    const items = parseBulk(text)
    if (!items.length) return
    setStatus('Importing…')
    const count = await onImport(items)
    setStatus(`Imported ${count} into Inbox.`)
    setText('')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>
          Paste text
        </button>
        <button className={tab === 'smart' ? 'active' : ''} onClick={() => setTab('smart')}>
          Smart Import
        </button>
        <button className={tab === 'archive' ? 'active' : ''} onClick={() => setTab('archive')}>
          Blog archive
        </button>
      </div>

      {tab === 'text' && (
        <>
          <p className="section-label">Bulk import to Inbox</p>
          <textarea
            placeholder="Paste links or notes, one per line"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
          />
          <button onClick={handleImport}>Import to Inbox</button>
          {status && <p className="muted">{status}</p>}
        </>
      )}

      {tab === 'smart' && (
        <SmartImport topics={topics} onImport={onSmartImport} />
      )}

      {tab === 'archive' && (
        <ArchiveCrawl topics={topics} onImport={onArchiveImport} />
      )}
    </div>
  )
}
