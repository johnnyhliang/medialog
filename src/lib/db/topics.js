export async function listTopics(supabase) {
  const { data, error } = await supabase
    .from('topics')
    .select('*, entries!entries_topic_id_fkey(count)')
    .is('entries.deleted_at', null)
    .is('deleted_at', null)
    .is('pattern_target', null) // interview pattern-topics live in their own view
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((t) => ({ ...t, entry_count: t.entries?.[0]?.count ?? 0 }))
}

export async function listDeletedTopics(supabase) {
  const { data, error } = await supabase
    .from('topics')
    .select('*, entries!entries_topic_id_fkey(count)')
    .is('entries.deleted_at', null)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((t) => ({ ...t, entry_count: t.entries?.[0]?.count ?? 0 }))
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
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('name', name)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function createTopic(supabase, name) {
  const { data, error } = await supabase
    .from('topics')
    .insert({ name: String(name).slice(0, 120) })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function togglePinTopic(supabase, topicId, pinned) {
  const { data, error } = await supabase
    .from('topics')
    .update({ pinned })
    .eq('id', topicId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTopicIcon(supabase, topicId, icon) {
  const { data, error } = await supabase
    .from('topics')
    .update({ icon: icon || null })
    .eq('id', topicId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTopicDoc(supabase, topicId, masterDoc) {
  const { data, error } = await supabase
    .from('topics')
    .update({ master_doc: String(masterDoc ?? '') })
    .eq('id', topicId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function archiveTopic(supabase, id) {
  const { data, error } = await supabase
    .from('topics')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function unarchiveTopic(supabase, id) {
  const { data, error } = await supabase
    .from('topics')
    .update({ archived_at: null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function softDeleteTopic(supabase, id) {
  const now = new Date().toISOString()
  await supabase
    .from('entries')
    .update({ deleted_at: now })
    .eq('topic_id', id)
    .is('deleted_at', null)
  const { error } = await supabase
    .from('topics')
    .update({ deleted_at: now })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function restoreDeletedTopic(supabase, id) {
  await supabase
    .from('entries')
    .update({ deleted_at: null })
    .eq('topic_id', id)
    .not('deleted_at', 'is', null)
  const { error } = await supabase
    .from('topics')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
