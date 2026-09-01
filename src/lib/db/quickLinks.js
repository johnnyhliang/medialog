// DB helpers for the quick links / tools shelf. Same shape as the other db
// modules: requireUser for user_id, unwrap on every result.

import { unwrap, unwrapList } from './unwrap.js'
import { requireUser } from '../requireUser.js'

export async function listQuickLinks(supabase) {
  return unwrapList(await supabase
    .from('quick_links')
    .select('*')
    .order('position', { ascending: true }), 'listQuickLinks')
}

export async function createQuickLink(supabase, { label, url, note = null, position = 0 }) {
  // requireUser, not getUserOrNull: this only runs when someone has typed a
  // label and a URL and pressed add. Being signed out here is not an ordinary
  // outcome to skip past — it means the thing they just wrote is about to be
  // dropped, and the old `user.id` on an undefined user reported that as an
  // unrelated TypeError.
  const user = await requireUser(supabase)
  return unwrap(await supabase
    .from('quick_links')
    .insert({ user_id: user.id, label, url, note, position })
    .select()
    .single(), 'createQuickLink')
}

export async function updateQuickLink(supabase, id, patch) {
  unwrap(await supabase.from('quick_links').update(patch).eq('id', id), 'updateQuickLink')
}

export async function deleteQuickLink(supabase, id) {
  unwrap(await supabase.from('quick_links').delete().eq('id', id), 'deleteQuickLink')
}
