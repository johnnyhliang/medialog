const TAG_SELECT = '*, entry_tags(tags(name))'

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
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function createEntry(supabase, { topicId, url = null, title = null, note = '' }) {
  const { data, error } = await supabase
    .from('entries')
    .insert({ topic_id: topicId, url, title, note })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateEntry(supabase, id, patch) {
  const { data, error } = await supabase
    .from('entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteEntry(supabase, id) {
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function bulkCreateEntries(supabase, topicId, items) {
  const rows = items.map((it) => ({ topic_id: topicId, url: it.url ?? null, note: it.note ?? '' }))
  const { data, error } = await supabase.from('entries').insert(rows).select()
  if (error) throw new Error(error.message)
  return data
}

export async function searchEntries(supabase, query) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .or(`note.ilike.%${query}%,title.ilike.%${query}%`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function listForRevisit(supabase, limit) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .order('last_surfaced_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function markSurfaced(supabase, id) {
  const { error } = await supabase
    .from('entries')
    .update({ last_surfaced_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
