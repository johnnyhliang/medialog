import { Archive, Trash2 } from 'lucide-react'
import { timeAgo } from '../lib/timeFormat.js'

function nextIntervalLabel(entry, grade) {
  const ef = entry.srs_ef ?? 2.5
  const reps = entry.srs_reps ?? 0
  const interval = entry.srs_interval ?? 1
  if (grade < 3) return '1d'
  let newInterval
  if (reps === 0) newInterval = 1
  else if (reps === 1) newInterval = 6
  else newInterval = Math.max(1, Math.round(interval * ef))
  if (grade === 5) newInterval = Math.max(1, Math.round(newInterval * 1.3))
  return newInterval >= 365
    ? `${Math.round(newInterval / 365)}y`
    : newInterval >= 30
    ? `${Math.round(newInterval / 30)}mo`
    : newInterval >= 7
    ? `${Math.round(newInterval / 7)}w`
    : `${newInterval}d`
}

function ActivityItem({ entry }) {
  const age = timeAgo(entry.updated_at)
  const displayTitle = entry.title || entry.url || 'Untitled'
  const notePreview = entry.note ? entry.note.replace(/[#*`[\]>_]/g, '').slice(0, 100) : null

  return (
    <div className="activity-item">
      <div className="activity-item-header">
        {entry.url
          ? <a href={entry.url} target="_blank" rel="noreferrer" className="activity-title">{displayTitle}</a>
          : <span className="activity-title">{displayTitle}</span>
        }
        <div className="activity-meta">
          {entry.topicName && <span className="activity-topic">{entry.topicName}</span>}
          {age && <span className="activity-age">{age}</span>}
        </div>
      </div>
      {notePreview && <p className="activity-note-preview">{notePreview}</p>}
      {(entry.tags || []).length > 0 && (
        <div className="activity-tags">
          {entry.tags.map(t => <span key={t} className="activity-tag">#{t}</span>)}
        </div>
      )}
    </div>
  )
}

export default function Revisit({ entries, onSeen, onRate, onRetire, onArchive, onDelete, recentActivity = [] }) {
  // Always the head of the queue, never a cursor into it. Every action below
  // ends in applySeen(), which drops the entry from `entries` — the list
  // shrinking IS the advance. Incrementing an index on top of that advanced
  // twice per action, so a review session showed every *other* entry and
  // silently skipped the rest until the next load.
  const current = entries[0]

  async function handleRate(grade) {
    if (onRate) await onRate(current, grade)
    else await onSeen(current.id)
  }

  // The only action here that ends the loop. Hard/Good/Easy all reschedule and
  // Skip defers, so without this the queue has no way to shrink.
  async function handleRetire() {
    if (onRetire) await onRetire(current)
  }

  // Skip used to be a bare index bump — nothing was written, so the entry was
  // still first in the queue on the next load (listForRevisit orders by
  // last_surfaced_at, nulls first). Stamping it sends it to the back instead.
  // A failed write leaves the entry in the queue (the handlers only call
  // applySeen on success and toast for themselves), so you stay on the same
  // card rather than having it vanish while nothing actually changed.
  async function handleSkip() {
    if (onSeen) await onSeen(current.id)
  }

  async function handleArchive() {
    if (onArchive) await onArchive(current)
  }

  async function handleDelete() {
    if (onDelete) await onDelete(current)
  }

  const interval = current?.srs_interval ?? 1
  const reps = current?.srs_reps ?? 0

  return (
    <div className="revisit-view">
      <section className="revisit-section">
        <h3 className="section-label">Resurface</h3>
        {current ? (
          <div className="revisit-card">
            {current.url
              ? <a href={current.url} target="_blank" rel="noreferrer" className="card-title">{current.title || current.url}</a>
              : current.title && <span className="card-title">{current.title}</span>
            }
            {current.note && (
              <p className="revisit-note">{current.note.replace(/[#*`[\]>_]/g, '').slice(0, 300)}</p>
            )}
            {(current.tags || []).length > 0 && (
              <div className="activity-tags" style={{ marginTop: 6 }}>
                {current.tags.map(t => <span key={t} className="activity-tag">#{t}</span>)}
              </div>
            )}
            <div className="revisit-srs-row">
              <span className="revisit-srs-label">
                {reps === 0 ? 'First review' : `Review #${reps + 1} · current interval ${interval}d`}
              </span>
            </div>
            <div className="revisit-rating-row">
              <div className="revisit-rating-btns">
                <button
                  className="revisit-rate-btn revisit-rate-btn--hard"
                  onClick={() => handleRate(3)}
                  title="Hard — see again soon"
                >
                  Hard <span className="revisit-rate-interval">{nextIntervalLabel(current, 3)}</span>
                </button>
                <button
                  className="revisit-rate-btn revisit-rate-btn--good"
                  onClick={() => handleRate(4)}
                  title="Good"
                >
                  Good <span className="revisit-rate-interval">{nextIntervalLabel(current, 4)}</span>
                </button>
                <button
                  className="revisit-rate-btn revisit-rate-btn--easy"
                  onClick={() => handleRate(5)}
                  title="Easy — schedule further out"
                >
                  Easy <span className="revisit-rate-interval">{nextIntervalLabel(current, 5)}</span>
                </button>
              </div>
              <div className="revisit-end-btns">
                <button
                  className="btn-small revisit-skip-btn"
                  onClick={handleSkip}
                  title="Skip — send to the back of the queue"
                >
                  Skip
                </button>
                {onRetire && (
                  <button
                    className="btn-small revisit-retire-btn"
                    onClick={handleRetire}
                    title="Done with this — keep it, stop resurfacing it"
                  >
                    Done with it
                  </button>
                )}
                {(onArchive || onDelete) && (
                  <span className="revisit-btn-divider" aria-hidden="true" />
                )}
                {onArchive && (
                  <button
                    className="icon-btn revisit-archive-btn"
                    onClick={handleArchive}
                    aria-label="Archive this entry"
                    title="Archive"
                  >
                    <Archive size={15} />
                  </button>
                )}
                {onDelete && (
                  <button
                    className="icon-btn icon-btn-danger"
                    onClick={handleDelete}
                    aria-label="Move this entry to trash"
                    title="Move to trash"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>Nothing to resurface right now.</p>
        )}
      </section>

      <section className="revisit-section">
        <h3 className="section-label">Recently edited</h3>
        {recentActivity.length === 0
          ? <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>No recent activity yet.</p>
          : (
            <div className="activity-feed">
              {recentActivity.map(e => <ActivityItem key={e.id} entry={e} />)}
            </div>
          )
        }
      </section>
    </div>
  )
}
