import { listEntriesByTopic, listForRevisit, listRecentActivity, listTrashedEntries, searchEntries } from '../../../src/lib/db/entries.js'
import { getTopicByName, listTopics } from '../../../src/lib/db/topics.js'
import { normalizeLimit, normalizeName } from '../helpers.js'

export async function listTopicsView(supabase, params = {}) {
  const topics = await listTopics(supabase)
  const includeInbox = params.include_inbox !== false
  const filtered = includeInbox ? topics : topics.filter((topic) => topic.name !== 'Inbox')
  return {
    topics: filtered.map((topic) => ({
      id: topic.id,
      name: topic.name,
      entry_count: topic.entry_count,
    })),
  }
}

export async function listEntriesForTopic(supabase, params) {
  const topic = await resolveTopic(supabase, params)
  const entries = await listEntriesByTopic(supabase, topic.id)
  return {
    topic: { id: topic.id, name: topic.name, entry_count: topic.entry_count },
    entries,
  }
}

export async function searchGlobal(supabase, params) {
  const query = normalizeName(params.query)
  if (!query) throw new Error('Query is required.')
  const limit = normalizeLimit(params.limit, 20, 100)
  const results = await searchEntries(supabase, query)
  return { query, results: results.slice(0, limit) }
}

export async function listInbox(supabase, limit) {
  const inbox = await getTopicByName(supabase, 'Inbox')
  const entries = await listEntriesByTopic(supabase, inbox.id)
  return {
    inbox: {
      id: inbox.id,
      name: inbox.name,
      total: entries.length,
    },
    entries: entries.slice(0, limit),
  }
}

export async function dashboardOverview(supabase, params = {}) {
  const topics = await listTopics(supabase)
  const inbox = topics.find((t) => t.name === 'Inbox')
  const inboxEntries = inbox ? await listEntriesByTopic(supabase, inbox.id) : []
  const revisit = await listForRevisit(supabase, normalizeLimit(params.revisit_limit, 10, 20))
  const activity = await listRecentActivity(supabase, normalizeLimit(params.activity_limit, 10, 50))

  return {
    inbox: inbox ? { id: inbox.id, name: inbox.name, count: inboxEntries.length } : null,
    topics: topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      entry_count: topic.entry_count,
    })),
    revisit_queue: revisit,
    recent_activity: activity,
  }
}

export async function topicProgress(supabase, params) {
  const topic = await resolveTopic(supabase, params)
  const entries = await listEntriesByTopic(supabase, topic.id)
  const counts = entries.reduce(
    (acc, entry) => {
      const key = entry.status || 'unset'
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    { unset: 0, backlog: 0, active: 0, done: 0 },
  )

  return {
    topic: {
      id: topic.id,
      name: topic.name,
      entry_count: topic.entry_count,
    },
    status_counts: counts,
    sample_entries: entries.slice(0, 10),
  }
}

export async function recentActivity(supabase, limit) {
  return { entries: await listRecentActivity(supabase, limit) }
}

export async function listForRevisitView(supabase, limit) {
  return { entries: await listForRevisit(supabase, limit) }
}

export async function trashList(supabase, limit) {
  return { entries: (await listTrashedEntries(supabase)).slice(0, limit) }
}

async function resolveTopic(supabase, { topic_id, topic_name }) {
  if (topic_id) {
    const topics = await listTopics(supabase)
    const topic = topics.find((t) => t.id === topic_id)
    if (!topic) throw new Error(`Topic not found: ${topic_id}`)
    return topic
  }
  const name = normalizeName(topic_name)
  if (!name) throw new Error('Topic name is required.')
  return getTopicByName(supabase, name)
}
