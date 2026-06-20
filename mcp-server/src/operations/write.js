import { bulkCreateEntries, createEntry, updateEntry } from '../../../src/lib/db/entries.js'
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

export async function createTopicAction(supabase, params) {
  const name = normalizeName(params.name)
  if (!name) throw new Error('Topic name is required.')
  return { topic: await createTopic(supabase, name) }
}

export async function createEntryAction(supabase, params) {
  const topic = await resolveTopic(supabase, params)
  const entry = await createEntry(supabase, {
    topicId: topic.id,
    url: params.url ?? null,
    title: params.title ?? null,
    note: params.note ?? '',
  })
  return { entry }
}

export async function bulkCreateEntriesAction(supabase, params) {
  const topic = await resolveTopic(supabase, params)
  const entries = await bulkCreateEntries(supabase, topic.id, params.entries)
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
