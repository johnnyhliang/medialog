import { describe, it, expect, vi } from 'vitest'
import {
  loadAdminOverview, loadActivation, loadAccountProbe, loadAuditLog,
  setAccountTier, setAccountSuspended, setEmergencyStopWithReason,
} from '../../../../src/lib/db/adminMetrics.js'

// This module is only a transport — authorization and aggregation both live in
// the edge function. What is worth testing is that the reason reaches the
// server: a reason dropped in transit produces an audit log that looks complete
// and is useless, which is worse than no log at all.
function fakeSupabase(response = { data: { ok: true }, error: null }) {
  const invoke = vi.fn().mockResolvedValue(response)
  return { supabase: { functions: { invoke } }, invoke }
}
const bodyOf = (invoke) => invoke.mock.calls[0][1].body

describe('adminMetrics transport', () => {
  it('sends the reason with every mutating action', async () => {
    for (const [fn, args] of [
      [setAccountTier, ['u1', 'paid', 'upgraded after support email']],
      [setAccountSuspended, ['u1', true, 'runaway import loop']],
    ]) {
      const { supabase, invoke } = fakeSupabase()
      await fn(supabase, ...args)
      expect(bodyOf(invoke).reason).toBe(args[args.length - 1])
    }
  })

  it('sends the reason with the global emergency stop', async () => {
    const { supabase, invoke } = fakeSupabase()
    await setEmergencyStopWithReason(supabase, false, 'provider bill spike')
    expect(bodyOf(invoke)).toMatchObject({ action: 'set_ai_enabled', enabled: false, reason: 'provider bill spike' })
  })

  it('names the right action for each read', async () => {
    const cases = [
      [loadAdminOverview, [], 'overview'],
      [loadActivation, [], 'activation'],
      [loadAccountProbe, ['u1'], 'account'],
      [loadAuditLog, [], 'audit'],
    ]
    for (const [fn, args, action] of cases) {
      const { supabase, invoke } = fakeSupabase()
      await fn(supabase, ...args)
      expect(bodyOf(invoke).action).toBe(action)
    }
  })

  it('passes the target userId on an account probe', async () => {
    const { supabase, invoke } = fakeSupabase()
    await loadAccountProbe(supabase, 'abc-123')
    expect(bodyOf(invoke).userId).toBe('abc-123')
  })

  // A 403 arrives as an invoke error whose body holds the real reason; surfacing
  // "FunctionsHttpError" instead would send you looking in the wrong place.
  it('unwraps the server error message', async () => {
    const err = new Error('FunctionsHttpError')
    err.context = { json: () => Promise.resolve({ error: 'forbidden' }) }
    const { supabase } = fakeSupabase({ data: null, error: err })
    await expect(loadAuditLog(supabase)).rejects.toThrow('forbidden')
  })

  it('throws when the function returns an error in the body', async () => {
    const { supabase } = fakeSupabase({ data: { error: 'unknown action: nope' }, error: null })
    await expect(loadActivation(supabase)).rejects.toThrow('unknown action: nope')
  })
})
