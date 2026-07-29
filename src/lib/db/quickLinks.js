// DB helpers for the quick links / tools shelf. Same shape as the other db
// modules: auth.getUser for user_id, throw on error.

export async function listQuickLinks(supabase) {
  const { data, error } = await supabase
    .from('quick_links')
    .select('*')
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createQuickLink(supabase, { label, url, note = null, position = 0 }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('quick_links')
    .insert({ user_id: user.id, label, url, note, position })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateQuickLink(supabase, id, patch) {
  const { error } = await supabase.from('quick_links').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteQuickLink(supabase, id) {
  const { error } = await supabase.from('quick_links').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
