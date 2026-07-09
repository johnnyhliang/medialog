import { useEffect, useState } from 'react'
import { BookOpen, Plus } from 'lucide-react'
import { listDeepTopics, createDeepTopic } from '../lib/db/deepTopics.js'
import { uploadAttachment } from '../lib/storage.js'

const SOURCE_KINDS = [
  { key: 'book', label: 'Book (no file)' },
  { key: 'web', label: 'Web article' },
  { key: 'paper', label: 'Paper (URL)' },
  { key: 'pdf', label: 'PDF (link or upload)' },
]

export default function ReadingView({ supabase, onOpenTopic, addToast }) {
  const [topics, setTopics] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [sourceKind, setSourceKind] = useState('book')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try { setTopics(await listDeepTopics(supabase)) }
    catch (e) { addToast?.(e.message, 'error'); setTopics([]) }
  }
  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      let source_url = null
      if (sourceKind === 'web' || sourceKind === 'paper' || sourceKind === 'book') {
        source_url = url.trim() || null
      }
      if (sourceKind === 'pdf') {
        // A pasted link is hotlinked straight into the viewer — no upload, no
        // storage used. Uploading is the fallback for files you don't host.
        const pasted = url.trim()
        if (pasted) source_url = pasted
        else if (file) source_url = (await uploadAttachment(supabase, file)).url
        else { addToast?.('Paste a PDF link or choose a file', 'error'); setBusy(false); return }
      }
      const created = await createDeepTopic(supabase, { name: name.trim(), source_kind: sourceKind, source_url })
      setName(''); setUrl(''); setFile(null); setShowAdd(false)
      await load()
      onOpenTopic?.(created.id)
    } catch (e) { addToast?.(e.message, 'error') }
    setBusy(false)
  }

  return (
    <div className="rd-view">
      <div className="rd-header">
        <h2 className="rd-title"><BookOpen size={20} /> reading</h2>
        <button className="rd-add-btn" onClick={() => setShowAdd((v) => !v)}>
          <Plus size={14} /> new resource
        </button>
      </div>

      {showAdd && (
        <div className="rd-add-form">
          <input placeholder="name (e.g. Trading & Exchanges)" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={sourceKind} onChange={(e) => setSourceKind(e.target.value)}>
            {SOURCE_KINDS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {(sourceKind === 'web' || sourceKind === 'paper') && (
            <input placeholder="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          )}
          {sourceKind === 'book' && (
            <input placeholder="reference url (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          )}
          {sourceKind === 'pdf' && (
            <>
              <input placeholder="pdf link (hotlinked — no storage used)" value={url} onChange={(e) => setUrl(e.target.value)} />
              {!url.trim() && (
                <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              )}
              <p className="rd-hint">
                Paste a direct PDF link to read it without uploading. The viewer needs the host to
                allow cross-origin requests; if it won't render, use “open original” or upload instead.
              </p>
            </>
          )}
          <div className="rd-add-actions">
            <button onClick={handleCreate} disabled={busy || !name.trim()}>{busy ? 'adding…' : 'add'}</button>
            <button onClick={() => setShowAdd(false)}>cancel</button>
          </div>
        </div>
      )}

      {topics === null ? (
        <p className="muted">loading…</p>
      ) : topics.length === 0 ? (
        <p className="muted">No resources yet. Add a book, article, paper, or PDF to read through.</p>
      ) : (
        <div className="rd-grid">
          {topics.map((t) => (
            <button key={t.id} className="rd-card" onClick={() => onOpenTopic?.(t.id)}>
              <span className="rd-card-name">{t.name}</span>
              <span className="rd-card-kind">{t.source_kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
