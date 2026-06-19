import { useCallback, useEffect, useState } from 'react'
import StorageBar from './StorageBar.jsx'
import FileRow from './FileRow.jsx'
import ConfirmModal from './ConfirmModal.jsx'

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

export default function FilesView({ supabase, onSelectEntry }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('date')
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [supabase])

  const loadFiles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.storage.from('attachments').list(userId)
    setFiles(data || [])
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

  function getPublicUrl(file) {
    return supabase.storage.from('attachments').getPublicUrl(`${userId}/${file.name}`).data.publicUrl
  }

  const sorted = sortFiles(files, sortBy)
  const visible = sorted.slice(0, pageSize)
  const totalBytes = files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0)
  const remaining = sorted.length - pageSize

  if (loading) {
    return <div className="files-view"><p className="muted">Loading files…</p></div>
  }

  return (
    <div className="files-view">
      <h2 className="files-heading">Your Files</h2>
      <StorageBar totalBytes={totalBytes} capBytes={CAP_BYTES} />

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
        <span className="files-count muted">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>

      {files.length === 0 ? (
        <p className="muted files-empty">No files uploaded yet.</p>
      ) : (
        <>
          <div className="files-list">
            {visible.map(file => (
              <FileRow
                key={file.name}
                file={file}
                publicUrl={getPublicUrl(file)}
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
