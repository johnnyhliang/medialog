// DB helpers for the Gains Feed's menu_items (Quant Strand A/B/C). Dev reads
// deep-topic sections directly (src/lib/db/deepTopics.js); Interview reads its
// own pattern/problem tables — neither needs helpers here. See
// docs/gains-feed-design.md.

export async function listMenuItems(supabase) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('position', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function markMenuItemPulled(supabase, id) {
  const { error } = await supabase
    .from('menu_items')
    .update({ last_pulled_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setMenuItemStatus(supabase, id, status) {
  const { error } = await supabase.from('menu_items').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

// Bulk-add the starter menu for the signed-in user — the in-app onboarding
// path (no service role needed), mirroring how the Feed's starter pack works.
export async function seedStarterMenu(supabase, items) {
  const { data: { user } } = await supabase.auth.getUser()
  const rows = items.map((item) => ({ ...item, user_id: user.id }))
  const { data, error } = await supabase.from('menu_items').insert(rows).select()
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addMenuItem(supabase, { track, title }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('menu_items')
    .insert({ user_id: user.id, track, title })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
