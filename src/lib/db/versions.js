export async function listVersions(supabase, entryId) {
  const { data, error } = await supabase
    .from('entry_versions')
    .select('*')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function createVersion(supabase, entryId, note) {
  const { data, error } = await supabase
    .from('entry_versions')
    .insert({ entry_id: entryId, note })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
