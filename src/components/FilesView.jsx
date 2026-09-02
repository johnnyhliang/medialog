import { useCallback, useEffect, useState } from 'react'
import { FileText, Image as ImageIcon, ExternalLink } from 'lucide-react'
import StorageBar from './StorageBar.jsx'
import FileRow from './FileRow.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import { listNotesForHotlinks } from '../lib/db/entries.js'
import { collectHotlinks } from '../lib/hotlinks.js'
import { listSnapshots, archiveFile, snapshotUrl } from '../lib/db/snapshots.js'
import { listAttachments, signAttachmentUrl, deleteAttachment } from '../lib/db/files.js'
import { getUserOrNull } from '../lib/requireUser.js'

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
  const [archived, setArchived] = useState({}) // url -> snapshot row
  const [busyUrl, setBusyUrl] = useState(null)
  const [archiveError, setArchiveError] = useState(null)
  // The scan failing and the scan finding nothing are opposite answers, and this
  // tab exists to tell you which files are at risk — reporting "none found"
  // because the query died is the one wrong answer that actively costs the user
  // something. So: loading (`rows === null`) | error | empty, three states.
  const [scanError, setScanError] = useState(null)

  useEffect(() => {
    listNotesForHotlinks(supabase)
      .then((entries) => { setRows(collectHotlinks(entries)); setScanError(null) })
      .catch((e) => setScanError(e.message || 'could not scan your notes'))
    listSnapshots(supabase)
      .then((snaps) => setArchived(Object.fromEntries(snaps.map((s) => [s.url, s]))))
      .catch(() => {})
  }, [supabase])

  async function handleArchive(url) {
    setBusyUrl(url)
    setArchiveError(null)
    try {
      const snap = await archiveFile(supabase, { url })
      setArchived((prev) => ({ ...prev, [url]: snap }))
    } catch (e) {
      setArchiveError(`Couldn’t archive that file: ${e.message}`)
    }
    setBusyUrl(null)
  }

  async function openArchived(snap) {
    const signed = await snapshotUrl(supabase, snap.storage_path)
    if (signed) window.open(signed, '_blank', 'noopener')
  }

  if (scanError) {
    return (
      <p className="explore-semantic-error">
        Couldn’t scan your notes for hotlinked files: {scanError}
      </p>
    )
  }
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
        {rows.length} hotlinked file{rows.length !== 1 ? 's' : ''} across your notes · “save copy” stores an owned copy that survives link rot
      </p>
      {archiveError && <p className="explore-semantic-error">{archiveError}</p>}
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
              <span className="file-meta muted">
                {r.type} · {new URL(r.url).hostname.replace(/^www\./, '')}
                {archived[r.url] ? (
                  <button className="link-btn hotlink-archived" onClick={() => openArchived(archived[r.url])} title="Open your saved copy">
                    · archived ✓
                  </button>
                ) : (
                  <button
                    className="link-btn hotlink-archive"
                    onClick={() => handleArchive(r.url)}
                    disabled={busyUrl === r.url}
                  >
                    · {busyUrl === r.url ? 'saving…' : 'save copy'}
                  </button>
                )}
              </span>
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
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    // `getUserOrNull`, not `requireUser`: this runs on mount, before the
    // session has necessarily settled, and signed-out is an ordinary outcome
    // here rather than a failure — the effect below simply doesn't load. A
    // genuine auth error still throws, which is the case the old inline
    // `if (data?.user)` destructure couldn't express.
    getUserOrNull(supabase)
      .then((user) => { if (user) setUserId(user.id) })
      .catch((e) => setLoadError(e.message || 'could not confirm who you are'))
  }, [supabase])

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listAttachments(supabase, userId)
      setFiles(rows)
      const urls = {}
      for (const f of rows) {
        urls[f.name] = await signAttachmentUrl(supabase, userId, f.name)
      }
      setFileUrls(urls)
      setLoadError(null)
    } catch (e) {
      // An empty file list is a specific, reassuring claim ("nothing to back
      // up, nothing using your quota"). A failed listing must not be allowed
      // to make it — same reasoning as the hotlink scan's error state.
      setFiles([])
      setLoadError(e.message || 'could not load your files')
    }
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    if (!userId) return
    loadFiles()
  }, [userId, loadFiles])

  async function handleDeleteConfirm() {
    const name = deleteTarget.file.name
    setDeleteTarget(null)
    let deleteError = null
    try {
      await deleteAttachment(supabase, userId, name)
    } catch (e) {
      deleteError = `Couldn’t delete that file: ${e.message}`
    }
    // Reload either way: a failed delete should leave the row visible, and the
    // reload is what proves it is still there. The message is set afterwards
    // because a successful reload clears loadError.
    await loadFiles()
    if (deleteError) setLoadError(deleteError)
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
      {loadError && <p className="explore-semantic-error">{loadError}</p>}
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
        // Only claim "nothing here" when we actually know that; the error
        // above already says what happened otherwise.
        loadError ? null : <p className="muted files-empty">No files uploaded yet.</p>
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
