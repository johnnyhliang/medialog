import { listAgenda, listEntriesByTopic, listForRevisit, listOverdue, listRecentActivity, listTrashedEntries, searchEntries } from '../../../src/lib/db/entries.js'
import { getTopicByName, listTopics } from '../../../src/lib/db/topics.js'
import { groupAgenda } from '../../../src/lib/agenda.js'
import { assessWeek, rankTasks } from '../../../src/lib/priority.js'
import { normalizeLimit, normalizeName } from '../helpers.js'

// The server has no browser to read a timezone from, and an agenda bucketed in
// UTC would call something due tonight "overdue" from 8pm onward. Everything
// this log schedules happens in Ann Arbor.
const AGENDA_TZ = 'America/Detroit'

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

// --- Agenda -------------------------------------------------------------
//
// A reminder is an entry with `due_at` (migration 0072), so the backlog is not
// a separate store — it is a query. These two views are what the Sunday review
// runs on.

export async function agendaView(supabase, params = {}) {
  const entries = await listAgenda(supabase)
  const groups = groupAgenda(entries, new Date(), AGENDA_TZ)
  const shape = (list) => list.map((entry) => ({
    id: entry.id,
    title: entry.title,
    due_at: entry.due_at,
    topic: entry.topicName,
    status: entry.status ?? null,
  }))

  if (params.bucket) {
    const bucket = normalizeName(params.bucket)
    if (!(bucket in groups)) {
      throw new Error(`Unknown bucket: ${bucket}. Expected overdue, today, week, or later.`)
    }
    return { bucket, entries: shape(groups[bucket]), count: groups[bucket].length }
  }

  return {
    timezone: AGENDA_TZ,
    total: entries.length,
    overdue: shape(groups.overdue),
    today: shape(groups.today),
    week: shape(groups.week),
    later: shape(groups.later),
  }
}

export async function overdueView(supabase, limit) {
  const entries = await listOverdue(supabase, limit)
  return {
    count: entries.length,
    entries: entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      due_at: entry.due_at,
      topic: entry.topicName,
    })),
  }
}

// --- Planning -----------------------------------------------------------
//
// Ranking and feasibility live in src/lib/priority.js, tested against a fixed
// clock. These wrappers only fetch and shape.

export async function whatsNextView(supabase, params = {}) {
  const entries = await listAgenda(supabase)
  const limit = normalizeLimit(params.limit, 3, 5)
  const ranked = rankTasks(entries, new Date(), {
    limit,
    hardestCourse: params.hardest_course ?? null,
    timezone: AGENDA_TZ,
  })
  return { timezone: AGENDA_TZ, ...ranked }
}

export async function reviewWeekView(supabase, params = {}) {
  if (params.available_hours === undefined || params.available_hours === null) {
    throw new Error('available_hours is required — feasibility is meaningless without the slack to measure against.')
  }
  const entries = await listAgenda(supabase)
  return assessWeek(entries, params.available_hours, new Date(), {
    hardestCourse: params.hardest_course ?? null,
    horizonDays: normalizeLimit(params.horizon_days, 7, 31),
  })
}
