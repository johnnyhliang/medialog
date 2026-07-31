// Client for the founder-only operator dashboard.
//
// All aggregation happens in the `admin-metrics` edge function — RLS would make a
// client-side version silently return only your own rows, producing numbers that
// look right and aren't. Authorization is enforced there too; this module is only
// a transport.

async function call(supabase, body) {
  const { data, error } = await supabase.functions.invoke('admin-metrics', { body })
  if (error) {
    const detail = await error.context?.json?.().catch(() => null)
    throw new Error(detail?.error || error.message || 'admin-metrics failed')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export function loadAdminOverview(supabase) {
  return call(supabase, { action: 'overview' })
}

/** Manual tier change. Routed through set_tier_manual() so the founder guard holds. */
export function setAccountTier(supabase, userId, tier, reason) {
  return call(supabase, { action: 'set_tier', userId, tier, reason })
}

/** Week-one activation rates. Definitions live in supabase/queries/activation.sql. */
export function loadActivation(supabase) {
  return call(supabase, { action: 'activation' })
}

/**
 * Everything true about one account: tier, billing, index health, preservation
 * coverage, usage by day, event counts, and the operator actions taken on it.
 * Counts and statuses only — never note text, titles, URLs or search queries.
 */
export function loadAccountProbe(supabase, userId) {
  return call(supabase, { action: 'account', userId })
}

/** Operator action log, newest first. */
export function loadAuditLog(supabase, limit = 50) {
  return call(supabase, { action: 'audit', limit })
}

/** Own usage, for the Settings readout. Plain RLS-scoped RPCs, no admin rights. */
export async function getMyUsage(supabase) {
  const { data, error } = await supabase.rpc('my_ai_usage_this_month')
  if (error) return []
  return data ?? []
}

/** Rolling-window usage for the meter. Falls back to zeroes so the UI never breaks. */
export async function getMyWindowUsage(supabase, hours) {
  const { data, error } = await supabase.rpc('my_ai_usage_window', { p_hours: hours })
  if (error) return { calls: 0, resetsAt: null }
  const row = Array.isArray(data) ? data[0] : data
  return { calls: Number(row?.calls ?? 0), resetsAt: row?.resets_at ?? null }
}

/** Emergency controls — founder only, enforced in the edge function. */
export function setEmergencyStop(supabase, enabled) {
  return call(supabase, { action: 'set_ai_enabled', enabled })
}

export function setEmergencyStopWithReason(supabase, enabled, reason) {
  return call(supabase, { action: 'set_ai_enabled', enabled, reason })
}

export function setAccountSuspended(supabase, userId, suspended, reason) {
  return call(supabase, { action: 'set_suspended', userId, suspended, reason })
}

export async function getMyStorage(supabase) {
  const { data, error } = await supabase.rpc('my_storage_bytes')
  if (error) return 0
  return Number(data ?? 0)
}
