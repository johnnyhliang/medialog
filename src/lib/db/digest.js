export async function computeDigest(supabase, since, inboxTopicId) {
  const now = new Date()
  const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const sinceStr = since ? since.toISOString() : null

  const [
    capturedRes,
    completedRes,
    staleBacklogRes,
    oldInboxRes,
    readingQueueRes,
    recentTopicIdsRes,
    allTopicsRes,
  ] = await Promise.all([
    sinceStr
      ? supabase.from('entries').select('id, title, url, created_at, topic_id').gte('created_at', sinceStr).is('deleted_at', null)
      : supabase.from('entries').select('id, title, url, created_at, topic_id').is('deleted_at', null),
    sinceStr
      ? supabase.from('entries').select('id, title, url, updated_at, topic_id').gte('updated_at', sinceStr).eq('status', 'done').is('deleted_at', null)
      : supabase.from('entries').select('id, title, url, updated_at, topic_id').eq('status', 'done').is('deleted_at', null),
    supabase.from('entries').select('id, title, url, created_at, topic_id').eq('status', 'backlog').lt('created_at', sixtyDaysAgo).is('deleted_at', null).limit(40),
    inboxTopicId
      ? supabase.from('entries').select('id, title, url, created_at, topic_id').eq('topic_id', inboxTopicId).lt('created_at', fourteenDaysAgo).neq('status', 'done').is('deleted_at', null).limit(20)
      : Promise.resolve({ data: [] }),
    supabase.from('entries').select('id, title, url, created_at, topic_id').eq('status', 'active').is('deleted_at', null).order('created_at', { ascending: true }).limit(20),
    supabase.from('entries').select('topic_id').gte('updated_at', thirtyDaysAgo).is('deleted_at', null),
    supabase.from('topics').select('id, name, pattern_target, kind').is('archived_at', null),
  ])

  // Interview patterns are modeled as topics (pattern_target set) and deep-dive
  // resources as kind='deep'; their entries are curriculum problems / takeaways,
  // not library captures — keep them out of the digest entirely.
  const allTopics = allTopicsRes.data || []
  const excluded = new Set(
    allTopics.filter((t) => t.pattern_target != null || t.kind === 'deep').map((t) => t.id),
  )
  const keep = (rows) => (rows || []).filter((r) => !excluded.has(r.topic_id)).slice(0, 20)

  const recentTopicIds = new Set((recentTopicIdsRes.data || []).map(r => r.topic_id))
  const dormantTopics = allTopics
    .filter(t => !recentTopicIds.has(t.id) && !excluded.has(t.id) && t.pattern_target == null && t.kind !== 'deep')

  return {
    captured: keep(capturedRes.data),
    completed: keep(completedRes.data),
    staleBacklog: keep(staleBacklogRes.data),
    oldInbox: keep(oldInboxRes.data),
    readingQueue: (readingQueueRes.data || []).filter((r) => !excluded.has(r.topic_id)).slice(0, 5),
    dormantTopics,
  }
}
