import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { checkArchive, submitArchive } from '../lib/wayback.js'
import { updateEntry } from '../lib/db/entries.js'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function WaybackPopup({ entry, supabase, onClose, onEntryUpdate }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'done' | 'error'
  const [archiveInfo, setArchiveInfo] = useState(null) // { archived, timestamp, snapshotUrl }
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    checkArchive(entry.url)
      .then((info) => { setArchiveInfo(info); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [entry.url])

  async function handleSubmit() {
    setSubmitting(true)
    submitArchive(entry.url)
    try {
      const now = new Date().toISOString()
      const updated = await updateEntry(supabase, entry.id, { wayback_submitted_at: now })
      onEntryUpdate(updated)
      setSubmitted(true)
    } catch {
      setSubmitError('Could not save submission date')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} label="Wayback Machine" maxWidth="400px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, wordBreak: 'break-all' }}>{entry.url}</p>

        {status === 'loading' && <p className="muted">Checking archive…</p>}

        {status === 'error' && (
          <p className="muted">Couldn't reach the Wayback Machine. Check your connection.</p>
        )}

        {status === 'done' && archiveInfo && (
          <>
            {archiveInfo.archived ? (
              <p style={{ margin: 0, fontSize: 13 }}>
                Last archived {formatDate(archiveInfo.timestamp)} —{' '}
                <a href={archiveInfo.snapshotUrl} target="_blank" rel="noopener noreferrer">
                  view snapshot ↗
                </a>
              </p>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Never archived on the Wayback Machine.</p>
            )}

            {entry.wayback_submitted_at && !submitted && (
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                You submitted this on {formatDate(entry.wayback_submitted_at)}.
              </p>
            )}

            {submitted ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--accent)' }}>
                Submitted — archive.org will crawl this soon.
              </p>
            ) : (
              <button
                className="btn-small"
                onClick={handleSubmit}
                disabled={submitting}
                style={{ alignSelf: 'flex-start' }}
              >
                {submitting ? 'Opening…' : 'Archive now ↗'}
              </button>
            )}

            {submitError && <p className="muted" style={{ margin: 0, fontSize: 12 }}>{submitError}</p>}
          </>
        )}
      </div>
    </Modal>
  )
}
