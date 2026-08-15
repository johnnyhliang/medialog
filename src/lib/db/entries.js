import { buildSearchFilter } from '../searchFilter.js'
import { computeTitle } from '../entryTitle.js'
import { searchChunksAsEntries } from './retrieval.js'

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

export async function createEntry(supabase, { topicId, url = null, title = null, note = '', titleEdited = false }) {
  const noteText = clampNote(note)
  const mirrored = noteText.trim() || !title
  const finalTitle = mirrored ? computeTitle(noteText, url) : title
  const { data, error } = await supabase
    .from('entries')
    .insert({
      topic_id: topicId,
      url: clampUrl(url),
      title: finalTitle,
      note: noteText,
      // A title handed to us that we actually kept is a curated title, not a
      // mirror of the note — protect it from the first note edit onward.
      title_edited: titleEdited || !mirrored,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

// `title_edited` means "this title was set on purpose, stop mirroring". It is
// never inferred from the shape of the patch: a `title` key alone says nothing
// about intent, because link-preview enrichment writes titles through exactly
// the same path as a user typing one. There are only two kinds of title write:
//
//   - a USER title, which claims ownership. The caller passes
//     `title_edited: true` and it always lands.
//   - an AUTOMATIC title — mirrored from the note, or fetched from the page
//     (`autoTitle`). It lands only while the title is still unowned.
//
// Automatic titles are applied with a `title_edited = false` filter rather than
// a read-then-write, so a user title edit racing against them simply stops
// matching the row instead of being silently overwritten.
export async function updateEntry(supabase, id, patch, { autoTitle = false } = {}) {
  const next = { ...patch }
  if (typeof next.note === 'string') next.note = clampNote(next.note)

  let tentativeTitle = null
  if (autoTitle && typeof next.title === 'string') {
    tentativeTitle = next.title
  } else if (typeof next.note === 'string' && typeof next.title !== 'string' && next.note.trim()) {
    // A blank note has nothing to mirror. `computeTitle` would fall back to the
    // url — which callers like handleNoteSave don't send — and land on
    // 'Untitled', so clearing a note would silently wipe the title.
    tentativeTitle = computeTitle(next.note, next.url ?? null)
  }

  if (tentativeTitle !== null) {
    const { data: rows, error: autoError } = await supabase
      .from('entries')
      .update({ ...next, title: tentativeTitle })
      .eq('id', id)
      .eq('title_edited', false)
      .select()
    if (autoError) throw new Error(autoError.message)
    if (rows?.length) return rows[0]
    // No match: the user owns this title. Save everything else and leave it.
    delete next.title
    if (Object.keys(next).length === 0) {
      const { data: current, error: readError } = await supabase
        .from('entries')
        .select('*')
        .eq('id', id)
        .single()
      if (readError) throw new Error(readError.message)
      return current
    }
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
    // Same rule as createEntry: a title that came in with the import is
    // curated, so the first note edit must not overwrite it.
    title_edited: Boolean(it.title),
  }))
  const { data, error } = await supabase.from('entries').insert(rows).select()
  if (error) throw new Error(error.message)
  return data
}

export async function searchEntries(supabase, query) {
  // Plain substring match over note + title…
  const textQ = supabase
    .from('entries')
    .select(`${TAG_SELECT}, topics(name)`)
    .is('deleted_at', null)
    .or(buildSearchFilter(query))
    .or('surface_after.is.null,surface_after.lte.now()')
    .order('created_at', { ascending: false })

  // …plus entries carrying a tag whose name matches the query, so typing a tag
  // name in the search bar finds by tag (not just note/title text).
  const safe = query.replace(/[,()"\\*%_]/g, '').trim()
  const tagQ = safe
    ? supabase.from('entry_tags').select('entry_id, tags!inner(name)').ilike('tags.name', `%${safe}%`)
    : Promise.resolve({ data: [] })

  const [{ data, error }, { data: tagRows }] = await Promise.all([textQ, tagQ])
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const have = new Set(rows.map((r) => r.id))
  const extraIds = [...new Set((tagRows ?? []).map((r) => r.entry_id))].filter((id) => !have.has(id))

  let extra = []
  if (extraIds.length) {
    const { data: ed } = await supabase
      .from('entries')
      .select(`${TAG_SELECT}, topics(name)`)
      .in('id', extraIds)
      .is('deleted_at', null)
      .or('surface_after.is.null,surface_after.lte.now()')
    extra = ed ?? []
  }

  const merged = []
  const seen = new Set()
  for (const row of [...rows, ...extra]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push({ ...flattenTags(row), topicName: row.topics?.name ?? null })
  }
  return merged
}

export async function listForRevisit(supabase, limit) {
  const { data, error } = await supabase
    .from('entries')
    .select(`${TAG_SELECT}, srs_interval, srs_reps, srs_ef`)
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

// SM-2 grades: 3 = Hard, 4 = Good, 5 = Easy
function sm2(reps, ef, interval, grade) {
  if (grade < 3) {
    return { srs_reps: 0, srs_ef: Math.max(1.3, ef - 0.2), srs_interval: 1 }
  }
  const newEf = Math.max(1.3, ef + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  let newInterval
  if (reps === 0) newInterval = 1
  else if (reps === 1) newInterval = 6
  else newInterval = Math.max(1, Math.round(interval * ef))
  return { srs_reps: reps + 1, srs_ef: newEf, srs_interval: newInterval }
}

export async function rateRevisit(supabase, entry, grade) {
  const { srs_reps = 0, srs_ef = 2.5, srs_interval = 1 } = entry
  const next = sm2(srs_reps, srs_ef, srs_interval, grade)
  const nextDate = new Date(Date.now() + next.srs_interval * 86400000).toISOString()
  const { error } = await supabase
    .from('entries')
    .update({
      last_surfaced_at: new Date().toISOString(),
      surface_after: nextDate,
      ...next,
    })
    .eq('id', entry.id)
  if (error) throw new Error(error.message)
  return { ...next, surface_after: nextDate }
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

// Semantic search runs entirely on content_chunks (the whole library is
// backfilled). The legacy whole-entry path (entry_embeddings / match_entries)
// was retired in migration 0048.
export async function searchSemantic(supabase, query) {
  return searchChunksAsEntries(supabase, query)
}

// Notes across the whole library, for scanning externally-hotlinked media.
export async function listNotesForHotlinks(supabase) {
  const { data, error } = await supabase
    .from('entries')
    .select('id, title, topic_id, note')
    .is('deleted_at', null)
    .not('note', 'is', null)
    .neq('note', '')
  if (error) throw new Error(error.message)
  return data ?? []
}

export const ARCHIVE_PAGE_SIZE = 100

// Paginated so the Archive view can batch-load instead of pulling the whole
// (potentially huge) done pile at once. Returns { rows, hasMore }.
export async function listAllArchivedEntries(supabase, { limit = ARCHIVE_PAGE_SIZE, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from('entries')
    .select(`${TAG_SELECT}, topics(name)`)
    .eq('status', 'done')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  const rows = (data ?? []).map((row) => {
    const { topics, ...rest } = row
    return { ...flattenTags(rest), topicName: topics?.name ?? 'Unknown' }
  })
  return { rows, hasMore: rows.length === limit }
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

// --- Reminders (docs/intentional-app-spec.md Part 1) ---------------------
//
// A reminder is an entry with `due_at` set. There is no reminders table and no
// reminders query beyond this one: everything else an entry can do, a reminder
// does for free.

// Every dated, unfinished entry, soonest first. Deliberately returns a flat
// list rather than groups — the Overdue/Today/This week/Later split is pure
// date arithmetic that belongs in `src/lib/agenda.js`, where it can be tested
// against a fixed clock without a database.
export async function listAgenda(supabase) {
  const { data, error } = await supabase
    .from('entries')
    .select(`${TAG_SELECT}, topics(name)`)
    .is('deleted_at', null)
    .not('due_at', 'is', null)
    // Done reminders leave the agenda on their own — the spec's "archive on
    // done". Note this filter also keeps rows whose status is null, which is
    // most entries: `status` is nullable and a reminder captured in a hurry
    // will not have one. `.neq()` alone would drop those, because in SQL
    // `null != 'done'` is null, not true.
    .or('status.is.null,status.neq.done')
    // The snooze filter, same as every other list query. `surface_after` is
    // SCHEDULED and `due_at` is DEADLINE, so an entry can legitimately be due
    // Friday but hidden until Monday — and while hidden it stays off the
    // agenda, which is the point of snoozing it.
    .or('surface_after.is.null,surface_after.lte.now()')
    .order('due_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data.map((row) => ({ ...flattenTags(row), topicName: row.topics?.name ?? null }))
}

// Set or move a deadline. `isoDate` of null clears it, which is also how an
// entry stops being a reminder — there is no separate "delete reminder".
export async function setDueDate(supabase, id, isoDate) {
  const { error } = await supabase
    .from('entries')
    .update({ due_at: isoDate })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// Return at most 'limit' entries that are already past due, soonest first
export async function listOverdue(supabase, limit = 5) {
  const { data, error } = await supabase
    .from('entries')
    .select(`${TAG_SELECT}, topics(name)`)
    .is('deleted_at', null)
    .lt('due_at', new Date().toISOString())
    .or('status.is.null,status.neq.done')
    .or('surface_after.is.null,surface_after.lte.now()')
    .order('due_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data.map((row) => ({ ...flattenTags(row), topicName: row.topics?.name ?? null }))
}
