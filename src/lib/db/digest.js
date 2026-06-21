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
      ? supabase.from('entries').select('id, title, url, updated_at').gte('updated_at', sinceStr).eq('status', 'done').is('deleted_at', null)
      : supabase.from('entries').select('id, title, url, updated_at').eq('status', 'done').is('deleted_at', null),
    supabase.from('entries').select('id, title, url, created_at').eq('status', 'backlog').lt('created_at', sixtyDaysAgo).is('deleted_at', null).limit(20),
    inboxTopicId
      ? supabase.from('entries').select('id, title, url, created_at').eq('topic_id', inboxTopicId).lt('created_at', fourteenDaysAgo).neq('status', 'done').is('deleted_at', null).limit(20)
      : Promise.resolve({ data: [] }),
    supabase.from('entries').select('id, title, url, created_at').eq('status', 'active').is('deleted_at', null).order('created_at', { ascending: true }).limit(5),
    supabase.from('entries').select('topic_id').gte('updated_at', thirtyDaysAgo).is('deleted_at', null),
    supabase.from('topics').select('id, name').is('archived_at', null).is('deleted_at', null),
  ])

  const recentTopicIds = new Set((recentTopicIdsRes.data || []).map(r => r.topic_id))
  const dormantTopics = (allTopicsRes.data || []).filter(t => !recentTopicIds.has(t.id))

  return {
    captured: capturedRes.data || [],
    completed: completedRes.data || [],
    staleBacklog: staleBacklogRes.data || [],
    oldInbox: oldInboxRes.data || [],
    readingQueue: readingQueueRes.data || [],
    dormantTopics,
  }
}
