// Founder-only operator dashboard data, plus manual tier changes.
//
// This MUST be server-side. Cross-user aggregation from the client would hit RLS
// and silently return only the caller's own rows — producing numbers that look
// plausible and are wrong, which is worse than an error.
//
// Two actions, both founder-gated by the same check:
//   GET-ish  { action: 'overview' }                     → accounts + totals
//   POST     { action: 'set_tier', userId, tier }       → manual tier change
//
// Tier changes go through set_tier_manual() (migration 0062) rather than a direct
// update, so the founder-never-downgraded rule and the source='manual' marker
// stay in one place.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Authorization is a separate step from authentication: being signed in is not
  // being an operator. Read the tier with the service role so this cannot be
  // spoofed by a client-side claim.
  const { data: me } = await admin
    .from('user_entitlements').select('tier').eq('user_id', user.id).maybeSingle()
  if (me?.tier !== 'founder') return json({ error: 'forbidden' }, 403)

  const body = await req.json().catch(() => ({}))
  const action = body?.action ?? 'overview'

  // ── Manual tier change ────────────────────────────────────────────────────
  if (action === 'set_tier') {
    const { userId, tier } = body
    if (!userId || !['free', 'paid', 'founder'].includes(tier)) {
      return json({ error: 'userId and tier (free|paid|founder) are required' }, 400)
    }
    const { error } = await admin.rpc('set_tier_manual', { p_user_id: userId, p_tier: tier })
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, userId, tier })
  }

  // ── Emergency stop ────────────────────────────────────────────────────────
  // Deliberately coarse. In an emergency — leaked key, runaway client, surprise
  // bill — you want one lever that definitely works, not a nuanced policy.
  if (action === 'set_ai_enabled') {
    const { error } = await admin
      .from('app_flags')
      .update({ enabled: Boolean(body.enabled), updated_at: new Date().toISOString() })
      .eq('key', 'ai_enabled')
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, aiEnabled: Boolean(body.enabled) })
  }

  // Single-account brake. Blocks AI without changing tier, so the account keeps
  // its features and the suspension reads as temporary rather than a demotion.
  if (action === 'set_suspended') {
    if (!body.userId) return json({ error: 'userId is required' }, 400)
    const { error } = await admin
      .from('user_entitlements')
      .update({ ai_suspended: Boolean(body.suspended), updated_at: new Date().toISOString() })
      .eq('user_id', body.userId)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, userId: body.userId, suspended: Boolean(body.suspended) })
  }

  if (action !== 'overview') return json({ error: `unknown action: ${action}` }, 400)

  // ── Overview ──────────────────────────────────────────────────────────────
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const monthStartDay = monthStart.toISOString().slice(0, 10)

  const [usersRes, entRes, subsRes, usageRes, snapsRes, entriesRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('user_entitlements').select('user_id, tier, source, expires_at, ai_suspended'),
    admin.from('subscriptions').select('user_id, status, current_period_end, cancel_at_period_end'),
    admin.from('ai_usage').select('user_id, function_name, calls, input_tokens, output_tokens, est_cost_usd')
      .gte('day', monthStartDay),
    admin.from('snapshots').select('user_id, bytes'),
    admin.from('entries').select('user_id').is('deleted_at', null),
  ])

  const users = usersRes?.data?.users ?? []
  const tierBy = new Map((entRes.data ?? []).map((r) => [r.user_id, r]))
  const subBy = new Map((subsRes.data ?? []).map((r) => [r.user_id, r]))

  const sumBy = <T extends Record<string, unknown>>(
    rows: T[] | null, key: string, pick: (r: T) => number,
  ) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) {
      const k = String(r[key])
      m.set(k, (m.get(k) ?? 0) + pick(r))
    }
    return m
  }

  const aiCalls = sumBy(usageRes.data, 'user_id', (r) => Number(r.calls ?? 0))
  const aiCost = sumBy(usageRes.data, 'user_id', (r) => Number(r.est_cost_usd ?? 0))
  const bytes = sumBy(snapsRes.data, 'user_id', (r) => Number(r.bytes ?? 0))
  const entries = sumBy(entriesRes.data, 'user_id', () => 1)

  const accounts = users.map((u) => {
    const ent = tierBy.get(u.id)
    const sub = subBy.get(u.id)
    return {
      userId: u.id,
      email: u.email ?? null,
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      tier: ent?.tier ?? 'free',
      tierSource: ent?.source ?? null,
      aiSuspended: Boolean(ent?.ai_suspended),
      subscriptionStatus: sub?.status ?? null,
      cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
      currentPeriodEnd: sub?.current_period_end ?? null,
      aiCalls: aiCalls.get(u.id) ?? 0,
      aiCostUsd: Number((aiCost.get(u.id) ?? 0).toFixed(6)),
      storageBytes: bytes.get(u.id) ?? 0,
      entryCount: entries.get(u.id) ?? 0,
    }
  }).sort((a, b) => b.aiCostUsd - a.aiCostUsd)

  // Founder accounts are excluded from cost statistics: the operator's own usage
  // is unrepresentative and would skew every average it appears in.
  const billable = accounts.filter((a) => a.tier !== 'founder')
  const costs = billable.map((a) => a.aiCostUsd).sort((x, y) => x - y)
  const at = (p: number) => costs.length ? costs[Math.min(costs.length - 1, Math.floor(costs.length * p))] : 0

  const { data: aiFlag } = await admin
    .from('app_flags').select('enabled').eq('key', 'ai_enabled').maybeSingle()

  return json({
    aiEnabled: aiFlag?.enabled ?? true,
    generatedAt: new Date().toISOString(),
    monthStart: monthStartDay,
    totals: {
      users: accounts.length,
      byTier: accounts.reduce((acc: Record<string, number>, a) => {
        acc[a.tier] = (acc[a.tier] ?? 0) + 1
        return acc
      }, {}),
      paying: accounts.filter((a) => a.subscriptionStatus === 'active' || a.subscriptionStatus === 'trialing').length,
      aiCallsThisMonth: accounts.reduce((n, a) => n + a.aiCalls, 0),
      aiCostThisMonth: Number(accounts.reduce((n, a) => n + a.aiCostUsd, 0).toFixed(4)),
      storageBytes: accounts.reduce((n, a) => n + a.storageBytes, 0),
    },
    costStats: {
      excludesFounders: true,
      n: billable.length,
      medianUsd: at(0.5),
      p95Usd: at(0.95),
    },
    accounts,
  })
})
