import { useState } from 'react'

function timeAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

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

export default function Revisit({ entries, onSeen, onRate, recentActivity = [] }) {
  const [index, setIndex] = useState(0)
  const current = entries[index]

  async function handleRate(grade) {
    if (onRate) await onRate(current, grade)
    else await onSeen(current.id)
    setIndex((i) => i + 1)
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
              <button
                className="btn-small revisit-skip-btn"
                onClick={() => setIndex((i) => i + 1)}
                title="Skip without rating"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>Nothing to resurface right now.</p>
        )}
      </section>

      <section className="revisit-section">
        <h3 className="section-label">Recently edited</h3>
        {recentActivity.length === 0
          ? <p className="muted" style={{ fontSize: 13 }}>No recent activity yet.</p>
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
