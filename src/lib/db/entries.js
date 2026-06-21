import { buildSearchFilter } from '../searchFilter.js'
import { computeTitle } from '../entryTitle.js'

const TAG_SELECT = '*, entry_tags(tags(name))'
const MAX_NOTE = 10000
const MAX_URL = 2000

const clampUrl = (u) => (u ? String(u).slice(0, MAX_URL) : null)
const clampNote = (n) => String(n ?? '').slice(0, MAX_NOTE)

function flattenTags(row) {
  const tags = (row.entry_tags || []).map((et) => et.tags?.name).filter(Boolean)
  const { entry_tags, ...rest } = row
  return { ...rest, tags }
}

export async function listEntriesByTopic(supabase, topicId) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .eq('topic_id', topicId)
    .is('deleted_at', null)
    .or('surface_after.is.null,surface_after.lte.now()')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function createEntry(supabase, { topicId, url = null, title = null, note = '' }) {
  const noteText = clampNote(note)
  const finalTitle = noteText.trim()
    ? computeTitle(noteText, url)
    : (title || computeTitle('', url))
  const { data, error } = await supabase
    .from('entries')
    .insert({ topic_id: topicId, url: clampUrl(url), title: finalTitle, note: noteText })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateEntry(supabase, id, patch) {
  const next = { ...patch }
  if (typeof next.note === 'string') {
    next.note = clampNote(next.note)
    next.title = computeTitle(next.note, next.url ?? null)
  }
  const { data, error } = await supabase
    .from('entries')
    .update(next)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function bulkCreateEntries(supabase, topicId, items) {
  const rows = items.map((it) => ({
    topic_id: topicId,
    url: clampUrl(it.url),
    title: it.title ? String(it.title).slice(0, 300) : null,
    note: clampNote(it.note),
  }))
  const { data, error } = await supabase.from('entries').insert(rows).select()
  if (error) throw new Error(error.message)
  return data
}

export async function searchEntries(supabase, query) {
  const { data, error } = await supabase
    .from('entries')
    .select(`${TAG_SELECT}, topics(name)`)
    .is('deleted_at', null)
    .or(buildSearchFilter(query))
    .or('surface_after.is.null,surface_after.lte.now()')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map((row) => ({ ...flattenTags(row), topicName: row.topics?.name ?? null }))
}

export async function listForRevisit(supabase, limit) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .is('deleted_at', null)
    .or('surface_after.is.null,surface_after.lte.now()')
    .order('last_surfaced_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function listRecentActivity(supabase, limit = 30) {
  const { data, error } = await supabase
    .from('entries')
    .select(`${TAG_SELECT}, topics(name)`)
    .is('deleted_at', null)
    .or('surface_after.is.null,surface_after.lte.now()')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data.map((row) => ({ ...flattenTags(row), topicName: row.topics?.name ?? null }))
}

export async function listReadingQueue(supabase) {
  const { data, error } = await supabase
    .from('entries')
    .select(`${TAG_SELECT}, topics(name)`)
    .is('deleted_at', null)
    .in('status', ['active', 'backlog'])
    .or('surface_after.is.null,surface_after.lte.now()')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map((row) => ({ ...flattenTags(row), topicName: row.topics?.name ?? null }))
}

export async function markSurfaced(supabase, id) {
  const { error } = await supabase
    .from('entries')
    .update({ last_surfaced_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function softDeleteEntry(supabase, id) {
  const { error } = await supabase
    .from('entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listTrashedEntries(supabase) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function restoreEntry(supabase, id, inboxId) {
  const update = inboxId ? { deleted_at: null, topic_id: inboxId } : { deleted_at: null }
  const { error } = await supabase
    .from('entries')
    .update(update)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function emptyTrash(supabase) {
  const { error } = await supabase
    .from('entries')
    .delete()
    .not('deleted_at', 'is', null)
  if (error) throw new Error(error.message)
}

export async function searchSemantic(supabase, query) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return []

  const embedRes = await supabase.functions.invoke('embed-entry', {
    body: { text: query },
  })
  if (embedRes.error) throw new Error(embedRes.error.message)
  const embedding = embedRes.data?.embedding
  if (!embedding) return []

  const { data: matches, error } = await supabase.rpc('match_entries', {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: 20,
  })
  if (error) throw new Error(error.message)
  if (!matches?.length) return []

  const ids = matches.map((m) => m.entry_id)
  const { data: entries, error: eErr } = await supabase
    .from('entries')
    .select('*, entry_tags(tags(name)), topics(name)')
    .in('id', ids)
    .is('deleted_at', null)
  if (eErr) throw new Error(eErr.message)

  return entries.map((e) => {
    const match = matches.find((m) => m.entry_id === e.id)
    const tags = (e.entry_tags || []).map((et) => et.tags?.name).filter(Boolean)
    const { entry_tags, topics, ...rest } = e
    return { ...rest, tags, topicName: topics?.name ?? '', similarity: match?.similarity ?? 0 }
  }).sort((a, b) => b.similarity - a.similarity)
}

export async function listAllArchivedEntries(supabase) {
  const { data, error } = await supabase
    .from('entries')
    .select(`${TAG_SELECT}, topics(name)`)
    .eq('status', 'done')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map((row) => {
    const { topics, ...rest } = row
    return { ...flattenTags(rest), topicName: topics?.name ?? 'Unknown' }
  })
}

export async function listArchivedEntriesByTopic(supabase, topicId) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .eq('topic_id', topicId)
    .eq('status', 'done')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function snoozeEntry(supabase, id, isoDate) {
  const { error } = await supabase
    .from('entries')
    .update({ surface_after: isoDate })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function unsnoozeEntry(supabase, id) {
  const { error } = await supabase
    .from('entries')
    .update({ surface_after: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
