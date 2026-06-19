export async function listTopics(supabase) {
  const { data, error } = await supabase
    .from('topics')
    .select('*, entries!entries_topic_id_fkey(count)')
    .is('entries.deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  // Flatten embedded count: [{ count: N }] → entry_count: N
  return (data ?? []).map((t) => ({ ...t, entry_count: t.entries?.[0]?.count ?? 0 }))
}

export async function getTopicByName(supabase, name) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('name', name)
    .single()
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
