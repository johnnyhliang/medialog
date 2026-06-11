export async function listEntriesByTopic(supabase, topicId) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
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
    .select('*')
    .or(`note.ilike.%${query}%,title.ilike.%${query}%`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
