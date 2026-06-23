import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { computeDigest } from '../lib/db/digest.js'

function entryLabel(e) {
  return e.title || e.url || 'Untitled'
}

function shortDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function DigestView({ topics, inboxTopicId, onSortInbox, onGoToView, onOpenEntry, onStatusChange }) {
  const [timeWindow, setTimeWindow] = useState('7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try { localStorage.setItem('medialog_digest_last_viewed', String(Date.now())) } catch {}
  }, [])

  useEffect(() => {
    setLoading(true)
    const now = new Date()
    let since = null
    if (timeWindow === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000)
    else if (timeWindow === '30d') since = new Date(now - 30 * 24 * 60 * 60 * 1000)
    computeDigest(supabase, since, inboxTopicId).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [timeWindow, inboxTopicId])

  return (
    <div className="digest-view">
      <div className="digest-header">
        <h2>Digest</h2>
        <div className="digest-window-btns">
          <button className={timeWindow === '7d' ? 'active' : ''} onClick={() => setTimeWindow('7d')}>7 days</button>
          <button className={timeWindow === '30d' ? 'active' : ''} onClick={() => setTimeWindow('30d')}>30 days</button>
          <button className={timeWindow === 'all' ? 'active' : ''} onClick={() => setTimeWindow('all')}>All time</button>
        </div>
      </div>

      {loading && <p className="digest-loading">Loading…</p>}

      {!loading && data && (
        <div className="digest-body">

          {/* CTAs */}
          {(data.oldInbox.length > 0 || data.readingQueue.length > 3) && (
            <div className="digest-ctas">
              {data.oldInbox.length > 0 && onSortInbox && (
                <button className="digest-cta digest-cta--warn" onClick={onSortInbox}>
                  Sort Inbox ({data.oldInbox.length} old item{data.oldInbox.length === 1 ? '' : 's'})
                </button>
              )}
              {data.readingQueue.length > 3 && onGoToView && (
                <button className="digest-cta digest-cta--active" onClick={() => onGoToView('browse')}>
                  Review active queue ({data.readingQueue.length} active)
                </button>
              )}
            </div>
          )}

          <section className="digest-section">
            <h3>This period</h3>
            <p className="digest-stat">{data.captured.length} entries captured</p>
            {data.completed.length > 0 && (
              <>
                <p className="digest-stat">{data.completed.length} entries completed</p>
                <ul className="digest-list">
                  {data.completed.map(e => (
                    <li key={e.id}>
                      <span className="digest-item-title">{entryLabel(e)}</span>
                      <span className="digest-item-date">{shortDate(e.updated_at)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="digest-section">
            <h3>Needs attention</h3>

            {data.staleBacklog.length > 0 && (
              <div className="digest-subsection">
                <p className="digest-stat">{data.staleBacklog.length} stale backlog items (60+ days)</p>
                <ul className="digest-list">
                  {data.staleBacklog.map(e => (
                    <li key={e.id}>
                      <span className="digest-item-title">{entryLabel(e)}</span>
                      <span className="digest-item-date">{shortDate(e.created_at)}</span>
                      <span className="digest-item-actions">
                        {onOpenEntry && <button className="digest-action-btn" onClick={() => onOpenEntry(e)}>Open</button>}
                        {onStatusChange && <button className="digest-action-btn digest-action-btn--done" onClick={() => onStatusChange(e.id, 'done')}>Mark Done</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.oldInbox.length > 0 && (
              <div className="digest-subsection">
                <p className="digest-stat">{data.oldInbox.length} un-triaged inbox items (14+ days)</p>
                <ul className="digest-list">
                  {data.oldInbox.map(e => (
                    <li key={e.id}>
                      <span className="digest-item-title">{entryLabel(e)}</span>
                      <span className="digest-item-date">{shortDate(e.created_at)}</span>
                      <span className="digest-item-actions">
                        {onOpenEntry && <button className="digest-action-btn" onClick={() => onOpenEntry(e)}>Open</button>}
                        {onStatusChange && <button className="digest-action-btn digest-action-btn--done" onClick={() => onStatusChange(e.id, 'done')}>Mark Done</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.dormantTopics.length > 0 && (
              <div className="digest-subsection">
                <p className="digest-stat">{data.dormantTopics.length} dormant topics (no activity in 30 days)</p>
                <ul className="digest-list">
                  {data.dormantTopics.map(t => (
                    <li key={t.id}><span className="digest-item-title">{t.name}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {data.staleBacklog.length === 0 && data.oldInbox.length === 0 && data.dormantTopics.length === 0 && (
              <p className="digest-empty">Nothing needs attention.</p>
            )}
          </section>

          {data.readingQueue.length > 0 && (
            <section className="digest-section">
              <h3>Reading queue</h3>
              <p className="digest-stat muted">Oldest active entries</p>
              <ul className="digest-list">
                {data.readingQueue.map(e => (
                  <li key={e.id}>
                    {e.url
                      ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="digest-item-title">{entryLabel(e)}</a>
                      : <span className="digest-item-title">{entryLabel(e)}</span>
                    }
                    <span className="digest-item-date">{shortDate(e.created_at)}</span>
                    <span className="digest-item-actions">
                      {onOpenEntry && <button className="digest-action-btn" onClick={() => onOpenEntry(e)}>Open</button>}
                      {onStatusChange && <button className="digest-action-btn digest-action-btn--done" onClick={() => onStatusChange(e.id, 'done')}>Mark Done</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
