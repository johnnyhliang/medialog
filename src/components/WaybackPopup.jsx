// ⚠️ UNMOUNTED ON PURPOSE since 2026-08-06 — nothing renders this today.
//
// Not dead code, and not an oversight. `submitArchive` is a bare `window.open`,
// so it cannot learn whether archive.org accepted anything; the caller wrote
// `wayback_submitted_at` regardless and this popup then displayed it as done.
// Reporting a preservation you never verified is worse than reporting none,
// because the error surfaces only when you reach for the copy.
//
// `checkArchive` in the same lib is fine — it queries the availability API and
// returns a real answer. It is the *submit* half that cannot be trusted.
//
// Re-mount this once submission is verifiable via archive.org's SPN2 API (POST
// with S3-style keys → job id → poll status). That needs an edge function: the
// call is CORS-blocked from the browser and the keys must never ship in the
// bundle. See PROJECT-STATE §6 row 19 and IDEAS.md § External archival.
//
// Recorded here because a complete-but-uncalled function already cost this repo
// once this session (`renderReadme` shipped backups with no README for months).
// If you find this file and cannot tell why nothing imports it, that is the
// failure this comment exists to prevent.
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
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', margin: 0, wordBreak: 'break-all' }}>{entry.url}</p>

        {status === 'loading' && <p className="muted">Checking archive…</p>}

        {status === 'error' && (
          <p className="muted">Couldn't reach the Wayback Machine. Check your connection.</p>
        )}

        {status === 'done' && archiveInfo && (
          <>
            {archiveInfo.archived ? (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                Last archived {formatDate(archiveInfo.timestamp)} —{' '}
                <a href={archiveInfo.snapshotUrl} target="_blank" rel="noopener noreferrer">
                  view snapshot ↗
                </a>
              </p>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Never archived on the Wayback Machine.</p>
            )}

            {entry.wayback_submitted_at && !submitted && (
              <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                You submitted this on {formatDate(entry.wayback_submitted_at)}.
              </p>
            )}

            {submitted ? (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--accent)' }}>
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

            {submitError && <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{submitError}</p>}
          </>
        )}
      </div>
    </Modal>
  )
}
