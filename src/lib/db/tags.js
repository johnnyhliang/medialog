import { unwrap, unwrapList } from './unwrap.js'

export async function getOrCreateTag(supabase, name) {
  return unwrap(await supabase
    .from('tags')
    .upsert({ name }, { onConflict: 'user_id,name' })
    .select()
    .single(), 'getOrCreateTag')
}

export async function listTags(supabase) {
  // unwrapList rather than unwrap: this used to return `data` raw, which is
  // null when PostgREST returns no body, and App.jsx feeds the result straight
  // into `allTags.find(...)`. The array guarantee is safe here precisely
  // because an error has already thrown — it can only mean "no tags yet".
  return unwrapList(await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true }), 'listTags')
}

export async function updateTagColor(supabase, tagId, color) {
  unwrap(await supabase
    .from('tags')
    .update({ color: color || null })
    .eq('id', tagId), 'updateTagColor')
}

// Replace all of an entry's tag links with the given tag names.
export async function setEntryTags(supabase, entryId, names) {
  unwrap(await supabase.from('entry_tags').delete().eq('entry_id', entryId), 'setEntryTags:clear')
  if (names.length === 0) return
  const links = []
  for (const name of names) {
    const tag = await getOrCreateTag(supabase, name)
    links.push({ entry_id: entryId, tag_id: tag.id })
  }
  unwrap(await supabase.from('entry_tags').insert(links), 'setEntryTags:link')
}
