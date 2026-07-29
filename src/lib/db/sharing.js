import { randomSlug } from '../slug.js'

// Public sharing via a share registry (shared_items). A row's existence = public;
// deleting it = private. The public page is served by the `public-share` edge
// function, so RLS on entries/topics stays locked to owners.

export const SHARE_BASE = 'https://notes.johnnyliang.me/s/'

export function shareUrl(slug) {
  return `${SHARE_BASE}${slug}`
}

// Idempotent: returns the existing share for an entry, or creates one.
export async function shareEntry(supabase, entry) {
  const existing = await getEntryShare(supabase, entry.id)
  if (existing) return existing

  const slug = randomSlug()
  const { data, error } = await supabase
    .from('shared_items')
    .insert({ slug, kind: 'entry', ref_id: entry.id, title: entry.title ?? null })
    .select('slug, kind, ref_id, title, created_at')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function getEntryShare(supabase, entryId) {
  const { data, error } = await supabase
    .from('shared_items')
    .select('slug, kind, ref_id, title, created_at')
    .eq('kind', 'entry')
    .eq('ref_id', entryId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function listShares(supabase) {
  const { data, error } = await supabase
    .from('shared_items')
    .select('slug, kind, ref_id, title, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

// Unshare — deleting the registry row makes the public page 404 immediately.
export async function removeShare(supabase, slug) {
  const { error } = await supabase.from('shared_items').delete().eq('slug', slug)
  if (error) throw new Error(error.message)
}
