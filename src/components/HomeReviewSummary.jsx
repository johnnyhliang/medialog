// src/components/HomeReviewSummary.jsx
import { useEffect, useState } from 'react'
import { getReviewCounts } from '../lib/db/review.js'

function recommendedAction({ inbox, oldInbox, staleBacklog, active }) {
  if (oldInbox > 0) return `Sort your inbox — ${oldInbox} item${oldInbox === 1 ? '' : 's'} are more than 2 weeks old`
  if (active > 3) return 'Your active queue is full — finish or defer something'
  if (staleBacklog > 5) return `Review stale backlog — ${staleBacklog} items haven't moved in 30 days`
  if (inbox > 0) return `${inbox} item${inbox === 1 ? '' : 's'} waiting in inbox`
  return 'Inbox is clear — nice.'
}

export default function HomeReviewSummary({ supabase, onSortInbox, onGoToDigest }) {
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    // Swallowing the error keeps the badges off the screen entirely rather
    // than showing five zeroes, which is the one thing this component must not
    // do: "all clear" and "the database is down" are opposite messages. There
    // is no toast because Home mounts this before anything the user asked for.
    getReviewCounts(supabase).then(setCounts).catch(() => {})
  }, [supabase])

  if (!counts) return null

  const { inbox, oldInbox, staleBacklog, active, dormant } = counts
  const action = recommendedAction(counts)
  const allClear = inbox === 0 && oldInbox === 0 && staleBacklog === 0 && active === 0 && dormant === 0

  return (
    <div className="home-review-summary">
      <div className="hrs-badges">
        {inbox > 0 && (
          <button className="hrs-badge" onClick={onSortInbox} title="Go to inbox">
            <span className="hrs-count">{inbox}</span>
            <span className="hrs-label">inbox</span>
          </button>
        )}
        {oldInbox > 0 && (
          <button className="hrs-badge hrs-badge--warn" onClick={onSortInbox} title="Old inbox items">
            <span className="hrs-count">{oldInbox}</span>
            <span className="hrs-label">old</span>
          </button>
        )}
        {active > 0 && (
          <button className="hrs-badge hrs-badge--active" onClick={onSortInbox} title="Active queue">
            <span className="hrs-count">{active}</span>
            <span className="hrs-label">active</span>
          </button>
        )}
        {staleBacklog > 0 && (
          <button className="hrs-badge hrs-badge--stale" onClick={onGoToDigest} title="Stale backlog">
            <span className="hrs-count">{staleBacklog}</span>
            <span className="hrs-label">stale</span>
          </button>
        )}
        {dormant > 0 && (
          <button className="hrs-badge hrs-badge--dormant" onClick={onGoToDigest} title="Dormant topics">
            <span className="hrs-count">{dormant}</span>
            <span className="hrs-label">dormant</span>
          </button>
        )}
        {allClear && (
          <span className="hrs-badge hrs-badge--clear">
            <span className="hrs-label">all clear</span>
          </span>
        )}
      </div>
      <p className="hrs-action">{action}</p>
    </div>
  )
}
