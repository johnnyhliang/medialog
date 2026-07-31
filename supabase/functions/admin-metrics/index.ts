// Founder-only operator dashboard data, plus manual tier changes.
//
// This MUST be server-side. Cross-user aggregation from the client would hit RLS
// and silently return only the caller's own rows — producing numbers that look
// plausible and are wrong, which is worse than an error.
//
// Actions, all founder-gated by the same check:
//   { action: 'overview' }                        → accounts + totals
//   { action: 'activation' }                      → cohort activation rates
//   { action: 'account', userId }                 → single-account probe
//   { action: 'audit', limit? }                   → operator action log
//   { action: 'set_tier', userId, tier, reason? }
//   { action: 'set_ai_enabled', enabled, reason? }
//   { action: 'set_suspended', userId, suspended, reason? }
//
// Tier changes go through set_tier_manual() (migration 0062) rather than a direct
// update, so the founder-never-downgraded rule and the source='manual' marker
// stay in one place.
//
// Every mutating action reads its prior state and writes an admin_actions row
// (migration 0069) BEFORE returning. The log records before/after, so undoing a
// change never requires remembering what the old value was.

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

  // Audit writes must never be the reason an operator action fails: a logging
  // outage would otherwise block the emergency stop, which is exactly backwards.
  // Same fire-and-forget contract as recordUsage() and chunkEntryAsync().
  async function audit(
    name: string, target: string | null, before: unknown, after: unknown,
  ): Promise<void> {
    try {
      await admin.rpc('log_admin_action', {
        p_actor: user.id,
        p_action: name,
        p_target: target,
        p_before: before ?? null,
        p_after: after ?? null,
        p_reason: typeof body?.reason === 'string' ? body.reason : null,
      })
    } catch (e) {
      console.error('audit write failed (action still applied):', e)
    }
  }

  // ── Manual tier change ────────────────────────────────────────────────────
  if (action === 'set_tier') {
    const { userId, tier } = body
    if (!userId || !['free', 'paid', 'founder'].includes(tier)) {
      return json({ error: 'userId and tier (free|paid|founder) are required' }, 400)
    }
    const { data: prev } = await admin
      .from('user_entitlements').select('tier, source').eq('user_id', userId).maybeSingle()
    const { error } = await admin.rpc('set_tier_manual', { p_user_id: userId, p_tier: tier })
    if (error) return json({ error: error.message }, 500)
    await audit('set_tier', userId, { tier: prev?.tier ?? null, source: prev?.source ?? null }, { tier })
    return json({ ok: true, userId, tier })
  }

  // ── Emergency stop ────────────────────────────────────────────────────────
  // Deliberately coarse. In an emergency — leaked key, runaway client, surprise
  // bill — you want one lever that definitely works, not a nuanced policy.
  if (action === 'set_ai_enabled') {
    const { data: prev } = await admin
      .from('app_flags').select('enabled').eq('key', 'ai_enabled').maybeSingle()
    const { error } = await admin
      .from('app_flags')
      .update({ enabled: Boolean(body.enabled), updated_at: new Date().toISOString() })
      .eq('key', 'ai_enabled')
    if (error) return json({ error: error.message }, 500)
    await audit('set_ai_enabled', null, { enabled: prev?.enabled ?? null }, { enabled: Boolean(body.enabled) })
    return json({ ok: true, aiEnabled: Boolean(body.enabled) })
  }

  // Single-account brake. Blocks AI without changing tier, so the account keeps
  // its features and the suspension reads as temporary rather than a demotion.
  if (action === 'set_suspended') {
    if (!body.userId) return json({ error: 'userId is required' }, 400)
    const { data: prev } = await admin
      .from('user_entitlements').select('ai_suspended').eq('user_id', body.userId).maybeSingle()
    const { error } = await admin
      .from('user_entitlements')
      .update({ ai_suspended: Boolean(body.suspended), updated_at: new Date().toISOString() })
      .eq('user_id', body.userId)
    if (error) return json({ error: error.message }, 500)
    await audit(
      'set_suspended', body.userId,
      { suspended: Boolean(prev?.ai_suspended) }, { suspended: Boolean(body.suspended) },
    )
    return json({ ok: true, userId: body.userId, suspended: Boolean(body.suspended) })
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  // Emails are resolved here rather than joined in SQL: admin_actions references
  // auth.users, which lives in a schema PostgREST does not expose.
  if (action === 'audit') {
    const limit = Math.min(200, Math.max(1, Number(body?.limit) || 50))
    const { data, error } = await admin
      .from('admin_actions')
      .select('id, actor_id, action, target_user_id, before, after, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return json({ error: error.message }, 500)
    const { data: uList } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const emailBy = new Map((uList?.users ?? []).map((u) => [u.id, u.email ?? null]))
    return json({
      entries: (data ?? []).map((r) => ({
        ...r,
        actorEmail: emailBy.get(r.actor_id) ?? null,
        targetEmail: r.target_user_id ? emailBy.get(r.target_user_id) ?? null : null,
      })),
    })
  }

  // ── Activation ────────────────────────────────────────────────────────────
  // PRIMARY: sorted the inbox at least once within 7 days of signup — the moment
  // the app stops being a bookmark pile and becomes a library.
  // SECONDARY: captured on two separate days in week one — sorting proves
  // comprehension, returning proves habit, and habit predicts retention better.
  //
  // Mirrors supabase/queries/activation.sql; that file remains the reference for
  // the definitions. Aggregated in TS rather than SQL so this needs no additional
  // security definer function. Fine at current scale; if `events` grows past a
  // few hundred thousand rows this should become a SQL rollup.
  if (action === 'activation') {
    const [{ data: uList }, evRes] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from('events').select('user_id, name, created_at')
        .in('name', ['inbox_sorted', 'entry_created']),
    ])
    const users = uList?.users ?? []
    const evByUser = new Map<string, { name: string; at: number; day: string }[]>()
    for (const e of evRes.data ?? []) {
      const list = evByUser.get(e.user_id) ?? []
      list.push({ name: e.name, at: new Date(e.created_at).getTime(), day: String(e.created_at).slice(0, 10) })
      evByUser.set(e.user_id, list)
    }
    const WEEK = 7 * 24 * 3600 * 1000
    // Founders are excluded: the operator activates by construction, and with a
    // handful of users that single row would swing the rate by double digits.
    const { data: ents } = await admin.from('user_entitlements').select('user_id, tier')
    const founders = new Set((ents ?? []).filter((e) => e.tier === 'founder').map((e) => e.user_id))

    const cohort = users.filter((u) => !founders.has(u.id))
    let sorted = 0, habitual = 0, anyEntry = 0
    for (const u of cohort) {
      const signup = new Date(u.created_at ?? 0).getTime()
      const inWeek = (evByUser.get(u.id) ?? []).filter((e) => e.at - signup <= WEEK)
      if (inWeek.some((e) => e.name === 'inbox_sorted')) sorted++
      const captureDays = new Set(inWeek.filter((e) => e.name === 'entry_created').map((e) => e.day))
      if (captureDays.size >= 2) habitual++
      if (captureDays.size >= 1) anyEntry++
    }
    const pct = (n: number) => (cohort.length ? Math.round((n / cohort.length) * 1000) / 10 : 0)
    return json({
      cohortSize: cohort.length,
      excludesFounders: true,
      primary: { label: 'sorted inbox in week 1', n: sorted, pct: pct(sorted) },
      secondary: { label: 'captured on 2+ days in week 1', n: habitual, pct: pct(habitual) },
      anyCapture: { label: 'captured at all in week 1', n: anyEntry, pct: pct(anyEntry) },
    })
  }

  // ── Single-account probe ──────────────────────────────────────────────────
  // The debugging view: when one account looks wrong, this answers "what is
  // actually true for them" without hand-written SQL. Deliberately reports
  // counts and statuses only — never note text, titles, URLs or search queries.
  // Being the operator is not a licence to read someone's library.
  if (action === 'account') {
    const uid = body?.userId
    if (!uid) return json({ error: 'userId is required' }, 400)
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

    const [entRes, subRes, entriesRes, usageRes, eventsRes, snapRes, actionsRes, uRes] =
      await Promise.all([
        admin.from('user_entitlements')
          .select('tier, source, expires_at, ai_suspended, updated_at').eq('user_id', uid).maybeSingle(),
        admin.from('subscriptions')
          .select('status, current_period_end, cancel_at_period_end').eq('user_id', uid).maybeSingle(),
        admin.from('entries')
          .select('index_status, index_error, full_text_status, created_at')
          .eq('user_id', uid).is('deleted_at', null),
        admin.from('ai_usage')
          .select('day, function_name, model, calls, input_tokens, output_tokens, est_cost_usd')
          .eq('user_id', uid).gte('day', since.slice(0, 10)).order('day', { ascending: false }),
        admin.from('events').select('name, created_at').eq('user_id', uid).gte('created_at', since),
        admin.from('snapshots').select('bytes').eq('user_id', uid),
        admin.from('admin_actions')
          .select('action, before, after, reason, created_at')
          .eq('target_user_id', uid).order('created_at', { ascending: false }).limit(20),
        admin.auth.admin.getUserById(uid),
      ])

    const tally = <T,>(rows: T[] | null, pick: (r: T) => string) => {
      const m: Record<string, number> = {}
      for (const r of rows ?? []) { const k = pick(r); m[k] = (m[k] ?? 0) + 1 }
      return m
    }
    const entries = entriesRes.data ?? []
    // Surfaced verbatim because an index error is the one field where the exact
    // provider message is what you need; it contains no user content.
    const indexErrors = entries.filter((e) => e.index_status === 'failed' && e.index_error)
      .slice(0, 5).map((e) => e.index_error)

    const days = [...new Set(entries.map((e) => String(e.created_at).slice(0, 10)))].sort()
    return json({
      userId: uid,
      email: uRes?.data?.user?.email ?? null,
      createdAt: uRes?.data?.user?.created_at ?? null,
      lastSignInAt: uRes?.data?.user?.last_sign_in_at ?? null,
      entitlement: entRes.data ?? null,
      subscription: subRes.data ?? null,
      entryCount: entries.length,
      activeDays: days.length,
      firstEntryAt: days[0] ?? null,
      lastEntryAt: days[days.length - 1] ?? null,
      indexStatus: tally(entries, (e) => e.index_status ?? 'not_attempted'),
      indexErrors,
      preservation: tally(entries, (e) => e.full_text_status ?? 'not_attempted'),
      storageBytes: (snapRes.data ?? []).reduce((n, r) => n + Number(r.bytes ?? 0), 0),
      usage: usageRes.data ?? [],
      events: tally(eventsRes.data, (e) => e.name),
      adminActions: actionsRes.data ?? [],
    })
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
