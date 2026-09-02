import { useEffect, useState } from 'react'
import { FileText, Trash2 } from 'lucide-react'
import { listEntriesReferencingFile } from '../lib/db/files.js'

function formatSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function displayName(filename) {
  // Strip UUID prefix: 36-char UUID + hyphen
  return filename.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, '')
}

export default function FileRow({ file, publicUrl, supabase, onDeleteClick, onSelectEntry }) {
  const [refs, setRefs] = useState(null)
  // Same three states as the hotlink scan: loading | failed | answered. "Used
  // in: —" is a claim that nothing references this file, and it is the claim
  // the delete confirmation leans on — so a failed lookup must not be able to
  // render as it.
  const [refsError, setRefsError] = useState(false)

  const size = file.metadata?.size || 0
  const mime = file.metadata?.mimetype || ''
  const isImage = mime.startsWith('image/')

  useEffect(() => {
    listEntriesReferencingFile(supabase, publicUrl)
      .then((rows) => { setRefs(rows); setRefsError(false) })
      .catch(() => { setRefs([]); setRefsError(true) })
  }, [publicUrl, supabase])

  return (
    <div className="file-row">
      <div className="file-row-thumb">
        {isImage
          ? <img src={publicUrl} alt={displayName(file.name)} className="file-thumb" />
          : <FileText size={32} className="file-icon" />
        }
      </div>
      <div className="file-row-info">
        <span className="file-name">{displayName(file.name)}</span>
        <span className="file-meta muted">{formatSize(size)} · {formatDate(file.created_at)}</span>
        <div className="file-refs">
          {refs === null
            ? <span className="muted">Loading…</span>
            : refsError
            ? <span className="muted">Couldn’t check which entries use this file.</span>
            : refs.length === 0
            ? <span className="muted">Used in: —</span>
            : (
              <span className="muted">
                Used in:{' '}
                {refs.map((e, i) => (
                  <span key={e.id}>
                    <button className="link-btn" onClick={() => onSelectEntry(e)}>
                      {e.title || 'Untitled'}
                    </button>
                    {i < refs.length - 1 && ', '}
                  </span>
                ))}
              </span>
            )
          }
        </div>
      </div>
      <button
        className="icon-btn icon-btn-danger"
        aria-label="delete"
        onClick={() => onDeleteClick(file, publicUrl, refs || [])}
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
