import { useCallback, useEffect, useState } from 'react'
import { FileText, Image as ImageIcon, ExternalLink } from 'lucide-react'
import StorageBar from './StorageBar.jsx'
import FileRow from './FileRow.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import { listNotesForHotlinks } from '../lib/db/entries.js'
import { collectHotlinks } from '../lib/hotlinks.js'

const CAP_BYTES = 500 * 1024 * 1024
const PAGE_SIZE = 30

function sortFiles(files, sortBy) {
  const copy = [...files]
  if (sortBy === 'size') {
    return copy.sort((a, b) => (b.metadata?.size || 0) - (a.metadata?.size || 0))
  }
  if (sortBy === 'type') {
    return copy.sort((a, b) => {
      const aImg = (a.metadata?.mimetype || '').startsWith('image/') ? 0 : 1
      const bImg = (b.metadata?.mimetype || '').startsWith('image/') ? 0 : 1
      if (aImg !== bImg) return aImg - bImg
      return a.name.localeCompare(b.name)
    })
  }
  return copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

function HotlinkedFiles({ supabase, onSelectEntry }) {
  const [rows, setRows] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    listNotesForHotlinks(supabase)
      .then((entries) => setRows(collectHotlinks(entries)))
      .catch(() => setRows([]))
  }, [supabase])

  if (rows === null) return <p className="muted">Scanning notes…</p>

  const q = query.trim().toLowerCase()
  const visible = (q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)) : rows)
    .sort((a, b) => b.refs.length - a.refs.length)

  if (rows.length === 0) {
    return <p className="muted files-empty">No externally-hotlinked images or PDFs found in your notes.</p>
  }

  return (
    <>
      <input
        className="files-search-input"
        placeholder="search hotlinked files…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="files-count muted" style={{ display: 'block', marginBottom: 10 }}>
        {rows.length} hotlinked file{rows.length !== 1 ? 's' : ''} across your notes
      </p>
      <div className="files-list">
        {visible.map((r) => (
          <div key={r.url} className="file-row">
            <div className="file-row-thumb">
              {r.type === 'image'
                ? <img src={r.url} alt={r.name} className="file-thumb" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                : <FileText size={32} className="file-icon" />}
            </div>
            <div className="file-row-info">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="file-name file-name--link">
                {r.name} <ExternalLink size={12} />
              </a>
              <span className="file-meta muted">{r.type} · {new URL(r.url).hostname.replace(/^www\./, '')}</span>
              <div className="file-refs">
                <span className="muted">Used in:{' '}
                  {r.refs.map((e, i) => (
                    <span key={e.id}>
                      <button className="link-btn" onClick={() => onSelectEntry(e)}>{e.title || 'Untitled'}</button>
                      {i < r.refs.length - 1 && ', '}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function FilesView({ supabase, onSelectEntry }) {
  const [tab, setTab] = useState('uploads') // 'uploads' | 'hotlinked'
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('date')
  const [nameQuery, setNameQuery] = useState('')
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [userId, setUserId] = useState(null)
  const [fileUrls, setFileUrls] = useState({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase])

  async function signUrl(fileName) {
    const { data } = await supabase.storage
      .from('attachments')
      .createSignedUrl(`${userId}/${fileName}`, 60 * 60) // 1-hour for file browser
    return data?.signedUrl ?? null
  }

  const loadFiles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.storage.from('attachments').list(userId)
    setFiles(data || [])
    const urls = {}
    for (const f of data || []) {
      urls[f.name] = await signUrl(f.name)
    }
    setFileUrls(urls)
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    if (!userId) return
    loadFiles()
  }, [userId, loadFiles])

  async function handleDeleteConfirm() {
    const path = `${userId}/${deleteTarget.file.name}`
    await supabase.storage.from('attachments').remove([path])
    setDeleteTarget(null)
    await loadFiles()
  }

  // Match against the human-readable name (UUID prefix stripped) so a search
  // for "invoice" finds "…-invoice.pdf".
  const q = nameQuery.trim().toLowerCase()
  const matched = q
    ? files.filter((f) => f.name.replace(/^[0-9a-f-]{37}/, '').toLowerCase().includes(q))
    : files
  const sorted = sortFiles(matched, sortBy)
  const visible = sorted.slice(0, pageSize)
  const totalBytes = files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0)
  const remaining = sorted.length - pageSize

  const header = (
    <>
      <h2 className="files-heading">Your Files</h2>
      <div className="files-tabs">
        <button className={`files-tab${tab === 'uploads' ? ' active' : ''}`} onClick={() => setTab('uploads')}>Uploads</button>
        <button className={`files-tab${tab === 'hotlinked' ? ' active' : ''}`} onClick={() => setTab('hotlinked')}>Hotlinked</button>
      </div>
    </>
  )

  if (tab === 'hotlinked') {
    return (
      <div className="files-view">
        {header}
        <HotlinkedFiles supabase={supabase} onSelectEntry={onSelectEntry} />
      </div>
    )
  }

  if (loading) {
    return <div className="files-view">{header}<p className="muted">Loading files…</p></div>
  }

  return (
    <div className="files-view">
      {header}
      <StorageBar totalBytes={totalBytes} capBytes={CAP_BYTES} />

      <input
        className="files-search-input"
        placeholder="search by file name…"
        value={nameQuery}
        onChange={(e) => { setNameQuery(e.target.value); setPageSize(PAGE_SIZE) }}
      />

      <div className="files-sort-row">
        <span className="files-sort-label muted">Sort by:</span>
        {['date', 'size', 'type'].map(s => (
          <button
            key={s}
            className={`files-sort-btn${sortBy === s ? ' active' : ''}`}
            onClick={() => setSortBy(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="files-count muted">
          {q ? `${matched.length} of ${files.length}` : `${files.length} file${files.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {files.length === 0 ? (
        <p className="muted files-empty">No files uploaded yet.</p>
      ) : matched.length === 0 ? (
        <p className="muted files-empty">No files matching “{nameQuery}”.</p>
      ) : (
        <>
          <div className="files-list">
            {visible.map(file => (
              <FileRow
                key={file.name}
                file={file}
                publicUrl={fileUrls[file.name] ?? ''}
                supabase={supabase}
                onDeleteClick={(f, url, refs) => setDeleteTarget({ file: f, publicUrl: url, refs })}
                onSelectEntry={onSelectEntry}
              />
            ))}
          </div>
          {remaining > 0 && (
            <button
              className="btn-ghost files-load-more"
              onClick={() => setPageSize(p => p + PAGE_SIZE)}
            >
              Load more ({remaining} remaining)
            </button>
          )}
        </>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.file.name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, '')}"? This will break any entries that embed it.${deleteTarget.refs.length > 0 ? ` Referenced in: ${deleteTarget.refs.map(e => e.title || 'Untitled').join(', ')}.` : ''}`}
          confirmLabel="Delete file"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
