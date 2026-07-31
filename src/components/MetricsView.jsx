import { Fragment, useEffect, useState } from 'react'
import {
  loadAdminOverview, setAccountTier, setAccountSuspended,
  setEmergencyStopWithReason, loadActivation, loadAccountProbe, loadAuditLog,
} from '../lib/db/adminMetrics.js'
import { formatBytes } from '../lib/limits.js'

// Founder-only operator view: who exists, what tier they're on, what they cost.
//
// A table rather than charts, deliberately — "who is paying and what do they
// cost me" is a lookup question, and a chart would answer it worse. Charts can
// come once there is enough history for a trend to mean something.

const TIERS = ['free', 'paid', 'founder']

const fmtUsd = (n) => `$${Number(n ?? 0).toFixed(n >= 1 ? 2 : 4)}`
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : '—')
const fmtDateTime = (s) => (s ? new Date(s).toLocaleString() : '—')

// A reversible action with no record of why is a trap: weeks later you find a
// paused account, cannot reconstruct what you saw, and the safe-feeling choice
// becomes "leave it paused" — the wrong default for someone paying you. Cancel
// aborts; empty is allowed, because forcing a reason produces "asdf".
function askReason(verb) {
  return window.prompt(`Why are you ${verb}? (recorded in the audit log)`, '')
}

export default function MetricsView({ supabase, addToast }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [activation, setActivation] = useState(null)
  const [audit, setAudit] = useState(null)
  const [probe, setProbe] = useState(null)      // { userId, loading, data, error }

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setData(await loadAdminOverview(supabase))
      setError(null)
    } catch (e) {
      setError(e.message)
    }
    // Secondary panels must not be able to break the dashboard: activation
    // depends on `events`, which is newer than the rest and may be empty.
    loadActivation(supabase).then(setActivation).catch(() => setActivation(null))
    loadAuditLog(supabase).then((d) => setAudit(d.entries)).catch(() => setAudit(null))
  }

  async function inspect(account) {
    if (probe?.userId === account.userId) { setProbe(null); return }  // click again to close
    setProbe({ userId: account.userId, loading: true })
    try {
      setProbe({ userId: account.userId, data: await loadAccountProbe(supabase, account.userId) })
    } catch (e) {
      setProbe({ userId: account.userId, error: e.message })
    }
  }

  async function toggleAi(enable) {
    // No confirm on re-enable; confirm on stop, because it is user-visible.
    if (!enable && !window.confirm('Disable AI for every account? Chat and indexing will return 503 until re-enabled.')) return
    const reason = askReason(enable ? 're-enabling AI' : 'stopping AI for everyone')
    if (reason === null) return
    try {
      await setEmergencyStopWithReason(supabase, enable, reason)
      setData((d) => ({ ...d, aiEnabled: enable }))
      addToast?.(enable ? 'AI re-enabled' : 'AI stopped for all accounts', enable ? 'success' : 'error')
      loadAuditLog(supabase).then((d) => setAudit(d.entries)).catch(() => {})
    } catch (e) { addToast?.(e.message, 'error') }
  }

  async function toggleSuspend(account) {
    const next = !account.aiSuspended
    const reason = askReason(next
      ? `pausing AI for ${account.email || 'this account'}`
      : `un-pausing ${account.email || 'this account'}`)
    if (reason === null) return
    setData((d) => ({
      ...d,
      accounts: d.accounts.map((a) => (a.userId === account.userId ? { ...a, aiSuspended: next } : a)),
    }))
    try {
      await setAccountSuspended(supabase, account.userId, next, reason)
      loadAuditLog(supabase).then((d) => setAudit(d.entries)).catch(() => {})
    } catch (e) { addToast?.(e.message, 'error'); load() }
  }

  async function changeTier(account, tier) {
    if (tier === account.tier) return
    const reason = askReason(`moving ${account.email || 'this account'} to ${tier}`)
    if (reason === null) return
    setSavingId(account.userId)
    // Optimistic: the server is authoritative, but a dropdown that doesn't move
    // until a round-trip completes feels broken.
    setData((d) => ({
      ...d,
      accounts: d.accounts.map((a) => (a.userId === account.userId ? { ...a, tier } : a)),
    }))
    try {
      await setAccountTier(supabase, account.userId, tier, reason)
      addToast?.(`${account.email || 'account'} → ${tier}`, 'success')
      loadAuditLog(supabase).then((d) => setAudit(d.entries)).catch(() => {})
    } catch (e) {
      addToast?.(e.message, 'error')
      load()
    }
    setSavingId(null)
  }

  if (error) return <div className="metrics-view"><p className="muted">⚠ {error}</p></div>
  if (!data) return <div className="metrics-view"><p className="muted">Loading…</p></div>

  const { totals, costStats, accounts } = data

  return (
    <div className="metrics-view">
      <div className="metrics-header">
        <h2>Metrics</h2>
        <button onClick={load}>refresh</button>
      </div>

      {/* Emergency stop lives at the top, not buried in a settings tab: the whole
          point is being able to reach it fast when spend is running away. */}
      <div className={`metrics-emergency${data.aiEnabled === false ? ' metrics-emergency--off' : ''}`}>
        <div>
          <strong>{data.aiEnabled === false ? 'AI is OFF for everyone' : 'AI enabled'}</strong>
          <span className="metrics-sub">
            {data.aiEnabled === false
              ? 'All chat and indexing calls return 503. Existing data is untouched.'
              : 'Global kill switch — stops all AI spend immediately, for every account.'}
          </span>
        </div>
        <button
          className={data.aiEnabled === false ? '' : 'metrics-danger'}
          onClick={() => toggleAi(data.aiEnabled === false)}
        >
          {data.aiEnabled === false ? 'turn AI back on' : 'emergency stop'}
        </button>
      </div>

      <div className="metrics-tiles">
        <Tile label="users" value={totals.users}
          sub={TIERS.map((t) => `${totals.byTier?.[t] ?? 0} ${t}`).join(' · ')} />
        <Tile label="paying" value={totals.paying}
          sub={totals.paying === 0 ? 'billing not wired yet' : 'active or trialing'} />
        <Tile label="AI cost (month)" value={fmtUsd(totals.aiCostThisMonth)}
          sub={`${totals.aiCallsThisMonth} calls`} />
        <Tile label="storage" value={formatBytes(totals.storageBytes)} sub="all accounts" />
      </div>

      {/* Activation, not engagement. "Did week one work" is the only question
          worth asking before there is enough history for a trend, and the two
          definitions are fixed in supabase/queries/activation.sql so the number
          cannot quietly change meaning between readings. */}
      {activation && activation.cohortSize > 0 && (
        <div className="metrics-tiles">
          <Tile label="activated" value={`${activation.primary.pct}%`}
            sub={`${activation.primary.n}/${activation.cohortSize} ${activation.primary.label}`} />
          <Tile label="habit" value={`${activation.secondary.pct}%`}
            sub={activation.secondary.label} />
          <Tile label="any capture" value={`${activation.anyCapture.pct}%`}
            sub={activation.anyCapture.label} />
        </div>
      )}

      {/* Founder accounts are excluded here because the operator's own usage is
          unrepresentative and would drag every average with it. Stated in the UI
          so the number is never read as all-users. */}
      <p className="metrics-note">
        Cost per user across {costStats.n} non-founder account{costStats.n === 1 ? '' : 's'} —
        median {fmtUsd(costStats.medianUsd)}, p95 {fmtUsd(costStats.p95Usd)}.
        Founder accounts excluded.
      </p>

      <div className="metrics-table-wrap">
        <table className="metrics-table">
          <thead>
            <tr>
              <th>account</th><th>tier</th><th>billing</th>
              <th className="num">AI calls</th><th className="num">cost</th>
              <th className="num">storage</th><th className="num">entries</th>
              <th>last seen</th><th>AI</th><th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <Fragment key={a.userId}>
              <tr>
                <td>
                  <span className="metrics-email">{a.email || a.userId.slice(0, 8)}</span>
                  <span className="metrics-sub">joined {fmtDate(a.createdAt)}</span>
                </td>
                <td>
                  <select
                    value={a.tier}
                    disabled={savingId === a.userId}
                    onChange={(e) => changeTier(a, e.target.value)}
                    aria-label={`tier for ${a.email || a.userId}`}
                  >
                    {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {a.tierSource === 'manual' && <span className="metrics-sub">manual</span>}
                </td>
                <td>
                  {a.subscriptionStatus
                    ? <>
                        {a.subscriptionStatus}
                        {a.cancelAtPeriodEnd && <span className="metrics-sub">cancels {fmtDate(a.currentPeriodEnd)}</span>}
                      </>
                    : <span className="muted">—</span>}
                </td>
                <td className="num">{a.aiCalls}</td>
                <td className="num">{fmtUsd(a.aiCostUsd)}</td>
                <td className="num">{formatBytes(a.storageBytes)}</td>
                <td className="num">{a.entryCount}</td>
                <td>{fmtDate(a.lastSignInAt)}</td>
                <td>
                  <button
                    className={a.aiSuspended ? 'metrics-danger' : ''}
                    onClick={() => toggleSuspend(a)}
                    title={a.aiSuspended ? 'AI paused for this account' : 'Pause AI for this account only'}
                  >
                    {a.aiSuspended ? 'paused' : 'pause'}
                  </button>
                </td>
                <td>
                  <button onClick={() => inspect(a)} aria-expanded={probe?.userId === a.userId}>
                    {probe?.userId === a.userId ? 'close' : 'inspect'}
                  </button>
                </td>
              </tr>
              {probe?.userId === a.userId && (
                <tr>
                  <td colSpan={10}><AccountProbe probe={probe} /></td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <AuditLog entries={audit} />
    </div>
  )
}

// The debugging surface. When one account looks wrong, this answers "what is
// actually true for them" without hand-written SQL against production.
// Deliberately counts and statuses only: being the operator is not a licence to
// read someone's library.
function AccountProbe({ probe }) {
  if (probe.loading) return <p className="muted">Loading…</p>
  if (probe.error) return <p className="muted">⚠ {probe.error}</p>
  const d = probe.data
  const failed = d.indexStatus?.failed ?? 0
  const notIndexed = d.indexStatus?.not_attempted ?? 0

  return (
    <div className="metrics-probe">
      <div className="metrics-probe-grid">
        <Fact label="entries" value={d.entryCount} />
        <Fact label="active days" value={d.activeDays} />
        <Fact label="first entry" value={fmtDate(d.firstEntryAt)} />
        <Fact label="last entry" value={fmtDate(d.lastEntryAt)} />
        <Fact label="storage" value={formatBytes(d.storageBytes)} />
        <Fact label="tier source" value={d.entitlement?.source ?? '—'} />
      </div>

      {/* Index health: what fraction of this account's notes are actually
          searchable. A failed embed is silent by nature — the note saves, the
          search just never finds it — so a non-zero `failed` is the single most
          important number on this panel. */}
      <StatusRow title="index health" counts={d.indexStatus} />
      {failed > 0 && (
        <p className="metrics-warn">
          {failed} note{failed === 1 ? '' : 's'} failed to index and {failed === 1 ? 'is' : 'are'} unsearchable.
          {d.indexErrors?.length > 0 && <span className="metrics-sub">last error: {d.indexErrors[0]}</span>}
        </p>
      )}
      {notIndexed > 0 && (
        <p className="metrics-sub">
          {notIndexed} never attempted — normal for entries created before indexing existed,
          or for entries with nothing chunkable (a bare bookmark with no note).
        </p>
      )}

      <StatusRow title="article preservation" counts={d.preservation} />
      <StatusRow title="events (30d)" counts={d.events} />

      {d.usage?.length > 0 && (
        <div className="metrics-probe-block">
          <strong>AI usage (30d)</strong>
          <table className="metrics-table metrics-table--compact">
            <thead><tr><th>day</th><th>function</th><th className="num">calls</th><th className="num">cost</th></tr></thead>
            <tbody>
              {d.usage.slice(0, 12).map((u, i) => (
                <tr key={i}>
                  <td>{u.day}</td><td>{u.function_name}</td>
                  <td className="num">{u.calls}</td><td className="num">{fmtUsd(u.est_cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.adminActions?.length > 0 && (
        <div className="metrics-probe-block">
          <strong>operator actions on this account</strong>
          <ul className="metrics-audit">
            {d.adminActions.map((r, i) => (
              <li key={i}>
                <span className="metrics-sub">{fmtDateTime(r.created_at)}</span> {r.action}
                {' '}<code>{summarize(r.before)} → {summarize(r.after)}</code>
                {r.reason && <em> — {r.reason}</em>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function StatusRow({ title, counts }) {
  const items = Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1])
  if (!items.length) return null
  return (
    <div className="metrics-probe-block">
      <strong>{title}</strong>
      <span className="metrics-statusrow">
        {items.map(([k, v]) => (
          <span key={k} className={k === 'failed' ? 'metrics-danger-text' : ''}>{k} {v}</span>
        ))}
      </span>
    </div>
  )
}

// before/after are recorded so undoing never requires remembering the old value
// — the log is self-sufficient.
function summarize(v) {
  if (v == null) return '—'
  return Object.entries(v).map(([k, x]) => `${k}=${x === null ? '—' : x}`).join(' ')
}

function AuditLog({ entries }) {
  if (!entries?.length) return null
  return (
    <div className="metrics-probe-block">
      <h3>Operator log</h3>
      <p className="metrics-sub">
        Every tier change, pause and emergency stop, with what it was before. Reads are not
        logged — looking at this page is not an event, and recording it would bury what matters.
      </p>
      <ul className="metrics-audit">
        {entries.map((r) => (
          <li key={r.id}>
            <span className="metrics-sub">{fmtDateTime(r.created_at)}</span>
            {' '}<strong>{r.action}</strong>
            {r.targetEmail && ` · ${r.targetEmail}`}
            {' '}<code>{summarize(r.before)} → {summarize(r.after)}</code>
            {r.reason ? <em> — {r.reason}</em> : <span className="metrics-sub"> (no reason given)</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="metrics-fact">
      <span className="metrics-tile-label">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div className="metrics-tile">
      <span className="metrics-tile-label">{label}</span>
      <span className="metrics-tile-value">{value}</span>
      {sub && <span className="metrics-tile-sub">{sub}</span>}
    </div>
  )
}
