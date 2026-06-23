// src/components/HomeReviewSummary.jsx
import { useEffect, useState } from 'react'

async function fetchSummaryCounts(supabase) {
  const now = new Date()
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    inboxTopicRes,
    staleBacklogRes,
    activeRes,
    recentTopicIdsRes,
    allTopicsRes,
  ] = await Promise.all([
    supabase.from('topics').select('id').eq('name', 'Inbox').maybeSingle(),
    supabase
      .from('entries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'backlog')
      .lt('updated_at', thirtyDaysAgo)
      .is('deleted_at', null),
    supabase
      .from('entries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deleted_at', null),
    supabase.from('entries').select('topic_id').gte('updated_at', thirtyDaysAgo).is('deleted_at', null),
    supabase.from('topics').select('id').is('archived_at', null),
  ])

  const inboxTopicId = inboxTopicRes.data?.id ?? null

  const [inboxRes, oldInboxRes] = await Promise.all([
    inboxTopicId
      ? supabase
          .from('entries')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', inboxTopicId)
          .is('deleted_at', null)
      : Promise.resolve({ count: 0 }),
    inboxTopicId
      ? supabase
          .from('entries')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', inboxTopicId)
          .lt('created_at', fourteenDaysAgo)
          .neq('status', 'done')
          .is('deleted_at', null)
      : Promise.resolve({ count: 0 }),
  ])

  const recentTopicIds = new Set((recentTopicIdsRes.data || []).map((r) => r.topic_id))
  const dormantCount = (allTopicsRes.data || []).filter((t) => !recentTopicIds.has(t.id)).length

  return {
    inbox: inboxRes.count ?? 0,
    oldInbox: oldInboxRes.count ?? 0,
    staleBacklog: staleBacklogRes.count ?? 0,
    active: activeRes.count ?? 0,
    dormant: dormantCount,
  }
}

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
    fetchSummaryCounts(supabase).then(setCounts).catch(() => {})
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
