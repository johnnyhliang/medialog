// Layer 1 of the three-layer gate — entitlement. See src/lib/modules.js for the
// composed check and docs/intentional-app-spec.md Part 2 for why the layers are
// separate.
//
// Client-side tier resolution is COSMETIC. It decides what UI to render, never
// what data is reachable — that stays enforced by RLS on the underlying tables
// and, for AI spend, by the server-side cap in the `ai` edge function. A user
// who forges a tier in devtools sees nav items that lead nowhere.

export const DEFAULT_TIER = 'free'

// Absence of a row means free, so a failed fetch degrades to the least
// privileged state rather than accidentally unlocking anything.
export function resolveTier(row) {
  const tier = row?.tier
  if (tier !== 'free' && tier !== 'paid' && tier !== 'founder') return DEFAULT_TIER
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return DEFAULT_TIER
  return tier
}

export async function loadEntitlement(supabase) {
  if (!supabase) return { tier: DEFAULT_TIER }
  const { data, error } = await supabase
    .from('user_entitlements')
    .select('tier, expires_at')
    .maybeSingle()
  if (error || !data) return { tier: DEFAULT_TIER }
  return { tier: resolveTier(data) }
}

export async function loadModulePrefs(supabase) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_configs')
    .select('modules')
    .maybeSingle()
  if (error || !data) return null
  return data.modules ?? null
}

// Writes a single module preference. Core modules are rejected here rather than
// only being hidden in the UI, so a stray call can't persist an unusable state.
export async function setModulePref(supabase, moduleId, enabled, currentPrefs) {
  const next = { ...(currentPrefs && typeof currentPrefs === 'object' ? currentPrefs : {}) }
  next[moduleId] = Boolean(enabled)
  const { error } = await supabase
    .from('user_configs')
    .update({ modules: next })
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
  if (error) throw new Error(error.message)
  return next
}
