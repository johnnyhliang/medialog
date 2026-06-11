export async function getOrCreateTag(supabase, name) {
  const { data, error } = await supabase
    .from('tags')
    .upsert({ name }, { onConflict: 'user_id,name' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function listTags(supabase) {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

// Replace all of an entry's tag links with the given tag names.
export async function setEntryTags(supabase, entryId, names) {
  const { error: delErr } = await supabase.from('entry_tags').delete().eq('entry_id', entryId)
  if (delErr) throw new Error(delErr.message)
  if (names.length === 0) return
  const links = []
  for (const name of names) {
    const tag = await getOrCreateTag(supabase, name)
    links.push({ entry_id: entryId, tag_id: tag.id })
  }
  const { error: insErr } = await supabase.from('entry_tags').insert(links)
  if (insErr) throw new Error(insErr.message)
}
