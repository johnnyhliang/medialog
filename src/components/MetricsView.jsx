import { useEffect, useState } from 'react'
import { loadAdminOverview, setAccountTier, setEmergencyStop, setAccountSuspended } from '../lib/db/adminMetrics.js'
import { formatBytes } from '../lib/limits.js'

// Founder-only operator view: who exists, what tier they're on, what they cost.
//
// A table rather than charts, deliberately — "who is paying and what do they
// cost me" is a lookup question, and a chart would answer it worse. Charts can
// come once there is enough history for a trend to mean something.

const TIERS = ['free', 'paid', 'founder']

const fmtUsd = (n) => `$${Number(n ?? 0).toFixed(n >= 1 ? 2 : 4)}`
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : '—')

export default function MetricsView({ supabase, addToast }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [savingId, setSavingId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setData(await loadAdminOverview(supabase))
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleAi(enable) {
    // No confirm on re-enable; confirm on stop, because it is user-visible.
    if (!enable && !window.confirm('Disable AI for every account? Chat and indexing will return 503 until re-enabled.')) return
    try {
      await setEmergencyStop(supabase, enable)
      setData((d) => ({ ...d, aiEnabled: enable }))
      addToast?.(enable ? 'AI re-enabled' : 'AI stopped for all accounts', enable ? 'success' : 'error')
    } catch (e) { addToast?.(e.message, 'error') }
  }

  async function toggleSuspend(account) {
    const next = !account.aiSuspended
    setData((d) => ({
      ...d,
      accounts: d.accounts.map((a) => (a.userId === account.userId ? { ...a, aiSuspended: next } : a)),
    }))
    try {
      await setAccountSuspended(supabase, account.userId, next)
    } catch (e) { addToast?.(e.message, 'error'); load() }
  }

  async function changeTier(account, tier) {
    if (tier === account.tier) return
    setSavingId(account.userId)
    // Optimistic: the server is authoritative, but a dropdown that doesn't move
    // until a round-trip completes feels broken.
    setData((d) => ({
      ...d,
      accounts: d.accounts.map((a) => (a.userId === account.userId ? { ...a, tier } : a)),
    }))
    try {
      await setAccountTier(supabase, account.userId, tier)
      addToast?.(`${account.email || 'account'} → ${tier}`, 'success')
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
              <th>last seen</th><th>AI</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.userId}>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
