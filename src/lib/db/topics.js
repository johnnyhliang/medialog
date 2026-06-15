export async function listTopics(supabase) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data
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
