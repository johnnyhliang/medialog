// DB helpers for deep topics: pattern of createFeed/createEntry (auth.getUser
// for user_id, throw on error). Takeaway notes reuse the entries table.

export async function createDeepTopic(supabase, { name, source_kind, source_url = null }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('topics')
    .insert({ user_id: user.id, name, kind: 'deep', source_kind, source_url })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function listDeepTopics(supabase) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('kind', 'deep')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

// Loads a deep topic with its ordered sections and takeaway entries.
export async function getDeepTopic(supabase, topicId) {
  const [topicRes, sectionsRes, takeawaysRes] = await Promise.all([
    supabase.from('topics').select('*').eq('id', topicId).single(),
    supabase.from('resource_sections').select('*').eq('topic_id', topicId).order('position', { ascending: true }),
    supabase.from('entries').select('id, topic_id, section_id, takeaway, note, parent_id, created_at')
      .eq('topic_id', topicId).is('deleted_at', null).order('created_at', { ascending: true }),
  ])
  if (topicRes.error) throw new Error(topicRes.error.message)
  return {
    topic: topicRes.data,
    sections: sectionsRes.data ?? [],
    takeaways: takeawaysRes.data ?? [],
  }
}

export async function addSection(supabase, { topicId, title, position }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('resource_sections')
    .insert({ user_id: user.id, topic_id: topicId, title, position })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function setCursor(supabase, topicId, sectionId) {
  const { error } = await supabase.from('topics').update({ cursor_section_id: sectionId }).eq('id', topicId)
  if (error) throw new Error(error.message)
}

export async function setSectionStatus(supabase, sectionId, status) {
  const { error } = await supabase.from('resource_sections').update({ status }).eq('id', sectionId)
  if (error) throw new Error(error.message)
}

export async function addTakeaway(supabase, { topicId, sectionId, takeaway, note = '', parentId = null }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: user.id, topic_id: topicId, section_id: sectionId, takeaway, note, parent_id: parentId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTakeaway(supabase, id, patch) {
  const { error } = await supabase.from('entries').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}
