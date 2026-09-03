import { bulkCreateEntries, createEntry, setDueDate, updateEntry } from '../../../src/lib/db/entries.js'
import { createTopic, getTopicByName, listTopics } from '../../../src/lib/db/topics.js'
import { normalizeName } from '../helpers.js'
import { listEntriesByTopic } from '../../../src/lib/db/entries.js'

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

async function resolveTargetTopic(supabase, params) {
  if (params.target_topic_id) {
    const topics = await listTopics(supabase)
    const topic = topics.find((t) => t.id === params.target_topic_id)
    if (!topic) throw new Error(`Topic not found: ${params.target_topic_id}`)
    return topic
  }
  const name = normalizeName(params.target_topic_name)
  if (!name) throw new Error('Target topic name is required.')
  return getTopicByName(supabase, name)
}

export async function createTopicAction(supabase, params, { userId = null } = {}) {
  const name = normalizeName(params.name)
  if (!name) throw new Error('Topic name is required.')
  return { topic: await createTopic(supabase, name, { userId }) }
}

export async function createEntryAction(supabase, params, { userId = null } = {}) {
  const topic = await resolveTopic(supabase, params)
  const entry = await createEntry(supabase, {
    topicId: topic.id,
    url: params.url ?? null,
    title: params.title ?? null,
    note: params.note ?? '',
    userId,
  })
  return { entry }
}

export async function bulkCreateEntriesAction(supabase, params, { userId = null } = {}) {
  const topic = await resolveTopic(supabase, params)
  const entries = await bulkCreateEntries(supabase, topic.id, params.entries, { userId })
  return { topic: { id: topic.id, name: topic.name }, created: entries, count: entries.length }
}

export async function moveEntryAction(supabase, params) {
  const target = await resolveTargetTopic(supabase, params)
  const entry = await updateEntry(supabase, params.entry_id, { topic_id: target.id })
  return {
    moved: {
      entry_id: params.entry_id,
      target_topic: { id: target.id, name: target.name },
      entry,
    },
  }
}

export async function bulkMoveEntriesAction(supabase, params) {
  const target = await resolveTargetTopic(supabase, params)
  const moved = []
  for (const entryId of params.entry_ids) {
    const entry = await updateEntry(supabase, entryId, { topic_id: target.id })
    moved.push({ entry_id: entryId, entry })
  }
  return {
    target_topic: { id: target.id, name: target.name },
    moved_count: moved.length,
    moved,
  }
}

export async function getInboxTopic(supabase) {
  return getTopicByName(supabase, 'Inbox')
}

export async function getTopicEntries(supabase, topicId) {
  return listEntriesByTopic(supabase, topicId)
}

// --- Deadlines ----------------------------------------------------------

function normalizeDue(value) {
  if (value === null) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid due date: ${value}. Expected an ISO 8601 timestamp, or null to clear.`)
  }
  return date.toISOString()
}

export async function setDueDateAction(supabase, params) {
  if (!params.entry_id) throw new Error('entry_id is required.')
  // `due_at` is intentionally allowed to be null: clearing the date is how an
  // entry stops being a reminder. There is no separate delete.
  const due = normalizeDue(params.due_at ?? null)
  await setDueDate(supabase, params.entry_id, due)
  return { entry_id: params.entry_id, due_at: due, cleared: due === null }
}

// The intake primitive. Everything that arrives mid-week with a deadline but no
// fixed time — a job application, an assignment, a recruiter follow-up — lands
// here in one call rather than create-then-update. Defaults to Inbox so a
// capture never blocks on choosing a topic.
export async function captureTaskAction(supabase, params, { userId = null } = {}) {
  const title = normalizeName(params.title)
  if (!title) throw new Error('title is required.')

  const topic = params.topic_id || params.topic_name
    ? await resolveTopic(supabase, params)
    : await getInboxTopic(supabase)

  // Two steps on purpose. createEntry mirrors the title from the note whenever
  // a note is present, so passing both here would silently discard the caller's
  // title and name the task after its own provenance note. Creating with the
  // title alone marks it curated (title_edited), and the note is attached
  // afterwards — updateEntry then leaves a curated title alone.
  const entry = await createEntry(supabase, {
    topicId: topic.id,
    url: params.url ?? null,
    title,
    userId,
  })
  const note = params.note ?? ''
  if (note) await updateEntry(supabase, entry.id, { note })

  const due = params.due_at ? normalizeDue(params.due_at) : null
  if (due) await setDueDate(supabase, entry.id, due)

  // An estimate is what makes the entry countable at the weekly review. It stays
  // optional: demanding one at capture time puts a decision in front of the
  // capture, which is the friction this is meant to remove.
  const estimate = params.estimate_minutes ?? null
  if (estimate !== null) {
    if (!Number.isFinite(Number(estimate)) || Number(estimate) <= 0) {
      throw new Error(`Invalid estimate_minutes: ${estimate}. Expected a positive number of minutes.`)
    }
    await updateEntry(supabase, entry.id, { estimate_minutes: Math.round(Number(estimate)) })
  }

  return {
    entry: { ...entry, due_at: due, estimate_minutes: estimate },
    topic: { id: topic.id, name: topic.name },
  }
}
