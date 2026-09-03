import { unwrap, unwrapList } from './unwrap.js'

export async function listTopics(supabase) {
  const res = await supabase
    .from('topics')
    .select('*, entries!entries_topic_id_fkey(count)')
    .is('entries.deleted_at', null)
    .is('deleted_at', null)
    .is('pattern_target', null) // interview pattern-topics live in their own view
    // Projects live in the Manager and nowhere else. Same precedent as the line
    // above: a topic with a plan is still a topic in the DATA, but the sidebar
    // is a list of subjects, and a book, a project and a subject rendering
    // identically there is what made it unusable. docs/manager-scope.md §2.
    .neq('kind', 'project')
    .order('name', { ascending: true })
  // unwrapList, not `data ?? []`: this list IS the sidebar, and a failed query
  // rendering as zero topics is indistinguishable from a brand-new account.
  return unwrapList(res, 'listTopics').map((t) => ({ ...t, entry_count: t.entries?.[0]?.count ?? 0 }))
}

/**
 * The projects: topics carrying a plan, for the Manager's outline.
 *
 * `kind` was dead after the reading UI was deleted (docs/tech-debt.md listed it
 * for `0077`). Reusing it here is why the split needs no migration — the column
 * already exists, defaults to 'note', and is indexed by nothing that cares.
 */
export async function listProjects(supabase) {
  const res = await supabase
    .from('topics')
    .select('*, entries!entries_topic_id_fkey(count)')
    .is('entries.deleted_at', null)
    .is('deleted_at', null)
    .eq('kind', 'project')
    .order('name', { ascending: true })
  return unwrapList(res, 'listProjects').map((t) => ({ ...t, entry_count: t.entries?.[0]?.count ?? 0 }))
}

/** Promote a topic into a project, or demote it back to an ordinary topic. */
export async function setTopicKind(supabase, id, kind) {
  const res = await supabase
    .from('topics')
    .update({ kind: kind === 'project' ? 'project' : 'note' })
    .eq('id', id)
    .select()
    .single()
  return unwrap(res, 'setTopicKind')
}

export async function listDeletedTopics(supabase) {
  const res = await supabase
    .from('topics')
    .select('*, entries!entries_topic_id_fkey(count)')
    .is('entries.deleted_at', null)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  return unwrapList(res, 'listDeletedTopics').map((t) => ({ ...t, entry_count: t.entries?.[0]?.count ?? 0 }))
}

/**
 * A topic by name — the oldest match, never an error on duplicates.
 *
 * This used `.single()`, which throws "Cannot coerce the result to a single
 * JSON object" the moment two topics share a name. Nothing prevents that:
 * there is no unique constraint on (user_id, name), and two topics called
 * `Inbox` did exist. Since this is the fallback used when resolving the inbox
 * for CAPTURE (App.jsx), a duplicate name broke saving things — the one path
 * that must never fail.
 *
 * `.order('created_at').limit(1)` makes it deterministic: the original wins,
 * not whichever row the planner returned first.
 */
export async function getTopicByName(supabase, name) {
  const res = await supabase
    .from('topics')
    .select('*')
    .eq('name', name)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return unwrap(res, 'getTopicByName')
}

// `userId` is optional and normally omitted: in the browser the column's
// default fills it from auth.uid(). A service-role caller has no auth.uid(),
// so it must say who it is writing as — and the key is only added when a value
// is present, because `user_id: undefined` serialises to null and RLS rejects
// it (same trap documented in feeds.js).
export async function createTopic(supabase, name, { userId = null } = {}) {
  const row = { name: String(name).slice(0, 120) }
  if (userId) row.user_id = userId
  const res = await supabase
    .from('topics')
    .insert(row)
    .select()
    .single()
  return unwrap(res, 'createTopic')
}

export async function togglePinTopic(supabase, topicId, pinned) {
  const res = await supabase
    .from('topics')
    .update({ pinned })
    .eq('id', topicId)
    .select()
    .single()
  return unwrap(res, 'togglePinTopic')
}

export async function updateTopicIcon(supabase, topicId, icon) {
  const res = await supabase
    .from('topics')
    .update({ icon: icon || null })
    .eq('id', topicId)
    .select()
    .single()
  return unwrap(res, 'updateTopicIcon')
}

export async function updateTopicDoc(supabase, topicId, masterDoc) {
  const res = await supabase
    .from('topics')
    .update({ master_doc: String(masterDoc ?? '') })
    .eq('id', topicId)
    .select()
    .single()
  return unwrap(res, 'updateTopicDoc')
}

export async function archiveTopic(supabase, id) {
  const res = await supabase
    .from('topics')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return unwrap(res, 'archiveTopic')
}

export async function unarchiveTopic(supabase, id) {
  const res = await supabase
    .from('topics')
    .update({ archived_at: null })
    .eq('id', id)
    .select()
    .single()
  return unwrap(res, 'unarchiveTopic')
}

export async function softDeleteTopic(supabase, id) {
  const now = new Date().toISOString()
  // This half was fire-and-forget. If the entries update failed the topic still
  // got tombstoned, so the topic vanished from the sidebar while its entries
  // stayed live everywhere else that queries them — orphaned rows nobody could
  // see the cause of. Unwrapping first means the topic is only deleted when its
  // entries actually went with it.
  unwrap(await supabase
    .from('entries')
    .update({ deleted_at: now })
    .eq('topic_id', id)
    .is('deleted_at', null), 'softDeleteTopic:entries')
  unwrap(await supabase
    .from('topics')
    .update({ deleted_at: now })
    .eq('id', id), 'softDeleteTopic')
}

export async function restoreDeletedTopic(supabase, id) {
  // Same discarded error as softDeleteTopic, mirrored: a failure here restored
  // the topic with none of its entries and reported success.
  unwrap(await supabase
    .from('entries')
    .update({ deleted_at: null })
    .eq('topic_id', id)
    .not('deleted_at', 'is', null), 'restoreDeletedTopic:entries')
  unwrap(await supabase
    .from('topics')
    .update({ deleted_at: null })
    .eq('id', id), 'restoreDeletedTopic')
}
