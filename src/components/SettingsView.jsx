import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { submitArchive } from '../lib/wayback.js'
import { listEntriesByTopic, updateEntry } from '../lib/db/entries.js'
import SharedManager from './SharedManager.jsx'
import CompaniesTab from './settings/CompaniesTab.jsx'
import KeybindsTab from './settings/KeybindsTab.jsx'
import KeywordsTab from './settings/KeywordsTab.jsx'
import ProgramsTab from './settings/ProgramsTab.jsx'
import GitHubTab from './settings/GitHubTab.jsx'
import ModulesTab from './ModulesTab.jsx'
import CaptureTokensTab from './settings/CaptureTokensTab.jsx'
import { searchSettings, SETTINGS_TABS } from '../lib/settingsIndex.js'
import { getMyUsage, getMyStorage, getMyWindowUsage } from '../lib/db/adminMetrics.js'
import { formatBytes, describeLimit, AI_WINDOW_HOURS } from '../lib/limits.js'
import UsageMeter from './UsageMeter.jsx'
import { loadEntitlement } from '../lib/entitlements.js'
import { readPref, writePref } from '../lib/localPref.js'

const SETTINGS_TAB_KEY = 'medialog_settings_tab'

export default function SettingsView({ topics, onRefreshData, addToast, allTags = [], onUpdateTagColor, archiveToast, onToggleArchiveToast, trashToast, onToggleTrashToast, themePalette, themeStyle, onSetPalette, onSetStyle, assistantEnabled, onToggleAssistant, isModuleVisible = () => true }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingColors, setPendingColors] = useState({})
  // SettingsView unmounts when you navigate away, so a plain useState sent you
  // back to Appearance every time — which reads as "my changes are gone" when the
  // tab you were actually editing is a different one.
  const [tab, setTabState] = useState(() => {
    const saved = readPref(SETTINGS_TAB_KEY, null)
    return SETTINGS_TABS.some((t) => t.id === saved) ? saved : 'appearance'
  })
  function setTab(id) {
    setTabState(id)
    writePref(SETTINGS_TAB_KEY, id)
  }
  const [twitterToken, setTwitterToken] = useState('')
  const [twitterSaving, setTwitterSaving] = useState(false)
  const [bulkTopic, setBulkTopic] = useState('')
  const [skipSubmitted, setSkipSubmitted] = useState(true)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkPaused, setBulkPaused] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null)
  const bulkPausedRef = useRef(false)
  const bulkCancelledRef = useRef(false)
  const [captureLog, setCaptureLog] = useState(null)
  const [settingsQuery, setSettingsQuery] = useState('')
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    if (tab !== 'behavior') return
    Promise.all([
      getMyUsage(supabase),
      getMyStorage(supabase),
      loadEntitlement(supabase),
      getMyWindowUsage(supabase, AI_WINDOW_HOURS),
    ])
      .then(([rows, bytes, ent, window]) =>
        setUsage({ rows, bytes, tier: ent?.tier ?? 'free', window }))
      .catch(() => setUsage(null))
  }, [tab])

  useEffect(() => {
    if (tab !== 'mobile') return
    supabase
      .from('capture_log')
      .select('id, url, ok, message, created_at')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setCaptureLog(data ?? []))
  }, [tab])

  async function loadConfig() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('user_configs')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      setConfig(data)
      setTwitterToken(data.twitter_auth_token ?? '')
    }
    setLoading(false)
  }



  async function handleSaveTwitterToken() {
    setTwitterSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('user_configs')
      .upsert({ user_id: user.id, twitter_auth_token: twitterToken || null }, { onConflict: 'user_id' })
    if (error) addToast(`Error: ${error.message}`, 'error')
    else addToast('Twitter token saved', 'success')
    setTwitterSaving(false)
  }

  async function handleBulkArchive() {
    if (!bulkTopic) return
    setBulkRunning(true)
    setBulkPaused(false)
    bulkPausedRef.current = false
    bulkCancelledRef.current = false

    const entries = await listEntriesByTopic(supabase, bulkTopic)
    let queue = entries.filter((e) => e.url)
    if (skipSubmitted) queue = queue.filter((e) => !e.wayback_submitted_at)

    setBulkProgress({ done: 0, total: queue.length, errors: [] })

    for (let i = 0; i < queue.length; i++) {
      if (bulkCancelledRef.current) break

      while (bulkPausedRef.current) {
        await new Promise((r) => setTimeout(r, 200))
        if (bulkCancelledRef.current) break
      }
      if (bulkCancelledRef.current) break

      const entry = queue[i]
      try {
        await submitArchive(entry.url)
        await updateEntry(supabase, entry.id, { wayback_submitted_at: new Date().toISOString() })
      } catch {
        setBulkProgress((p) => ({ ...p, errors: [...p.errors, entry.url] }))
      }

      setBulkProgress((p) => ({ ...p, done: i + 1 }))

      if (i < queue.length - 1) {
        await new Promise((r) => setTimeout(r, 5000))
      }
    }

    setBulkRunning(false)
  }

  function handlePause() {
    bulkPausedRef.current = true
    setBulkPaused(true)
  }

  function handleResume() {
    bulkPausedRef.current = false
    setBulkPaused(false)
  }

  function handleCancel() {
    bulkCancelledRef.current = true
    bulkPausedRef.current = false
    setBulkRunning(false)
    setBulkPaused(false)
    setBulkProgress(null)
  }

  if (loading) return <p>Loading settings...</p>

  // Tabs declaring a `module` are shown only when that module passes the composed
  // entitlement + preference check (src/lib/modules.js). Tabs with no `module` are
  // unconditional — the same rule NavSidebar uses, so there is one place that
  // decides who sees what rather than a second hardcoded list here.
  const TABS = SETTINGS_TABS.filter((t) => !t.module || isModuleVisible(t.module))

  const searching = settingsQuery.trim().length > 0
  // A tab can disappear while it is open (module switched off in another tab), so
  // fall back rather than render nothing. While searching, no tab is active —
  // results take over the surface entirely.
  const activeTab = searching
    ? null
    : (TABS.some((t) => t.id === tab) ? tab : 'appearance')

  const results = searchSettings(settingsQuery, isModuleVisible)

  return (
    <div className="settings-view">
      <div className="settings-search-wrap">
        <input
          className="settings-search"
          type="search"
          value={settingsQuery}
          onChange={(e) => setSettingsQuery(e.target.value)}
          placeholder="Search settings…"
          aria-label="Search settings"
        />
      </div>

      {/* Results replace the tab content rather than sitting beside it — the
          point of searching is that you no longer care which tab it was in. */}
      {searching && (
        <div className="settings-results">
          {results.length === 0 ? (
            <p className="muted">No settings match “{settingsQuery}”.</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.tab + r.label}>
                  <button
                    onClick={() => { setTab(r.tab); setSettingsQuery('') }}
                  >
                    <span className="settings-result-label">{r.label}</span>
                    <span className="settings-result-tab">
                      {/* Was `ALL_TABS`, which does not exist — this threw a
                          ReferenceError the moment any settings search result
                          rendered. The unfiltered list is right here: the label
                          should name the tab a result lives in even while the
                          module filter is narrowing what's shown. */}
                      {(SETTINGS_TABS.find((t) => t.id === r.tab) || {}).label || r.tab}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="settings-tabs" hidden={searching}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`settings-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'shared' && <SharedManager />}

      {activeTab === 'appearance' && (
  <section>
    <h2>Appearance</h2>
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <div>
        <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 13 }}>Color Palette</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { id: 'warm',            name: 'Warm Parchment', bg: '#F8F5EE', accent: '#3D5A4A' },
            { id: 'catppuccin-mocha',name: 'Catppuccin Mocha', bg: '#1e1e2e', accent: '#cba6f7' },
            { id: 'tokyo-night',     name: 'Tokyo Night',    bg: '#1a1b26', accent: '#7aa2f7' },
            { id: 'nord',            name: 'Nord',           bg: '#2e3440', accent: '#88c0d0' },
            { id: 'rose-pine',       name: 'Rosé Pine',      bg: '#191724', accent: '#eb6f92' },
          ].map(({ id, name, bg, accent }) => (
            <button
              key={id}
              title={name}
              onClick={() => onSetPalette(id)}
              style={{
                width: 44, height: 44, borderRadius: '50%', padding: 0, cursor: 'pointer',
                border: themePalette === id ? `3px solid ${accent}` : '2px solid transparent',
                outline: themePalette === id ? `2px solid ${accent}` : 'none',
                outlineOffset: 2,
                background: `conic-gradient(${bg} 0deg 180deg, ${accent} 180deg 360deg)`,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          {[
            { id: 'warm', name: 'Warm Parchment' },
            { id: 'catppuccin-mocha', name: 'Catppuccin Mocha' },
            { id: 'tokyo-night', name: 'Tokyo Night' },
            { id: 'nord', name: 'Nord' },
            { id: 'rose-pine', name: 'Rosé Pine' },
          ].find(p => p.id === themePalette)?.name ?? themePalette}
        </p>
      </div>

      <div>
        <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 13 }}>Style</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            {
              id: 'default', name: 'Default',
              preview: (
                <div style={{ width: 64, height: 40, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 40, height: 6, borderRadius: 3, background: 'var(--muted)', opacity: 0.5 }} />
                </div>
              ),
            },
            {
              id: 'brutalist', name: 'Neobrutalism',
              preview: (
                <div style={{ width: 64, height: 40, borderRadius: 2, background: 'var(--surface-2)', border: '2px solid var(--text)', boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 40, height: 6, borderRadius: 0, background: 'var(--text)', opacity: 0.7 }} />
                </div>
              ),
            },
            {
              id: 'glass', name: 'Glassmorphism',
              preview: (
                <div style={{ width: 64, height: 40, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%)' }} />
                  <div style={{ width: 40, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.3)' }} />
                </div>
              ),
            },
          ].map(({ id, name, preview }) => (
            <button
              key={id}
              title={name}
              onClick={() => onSetStyle(id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                border: themeStyle === id ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: themeStyle === id ? 'var(--accent-weak)' : 'var(--surface)',
                fontSize: 11, color: 'var(--text)', fontWeight: themeStyle === id ? 600 : 400,
              }}
            >
              {preview}
              {name}
            </button>
          ))}
        </div>
        {themeStyle === 'glass' && themePalette === 'warm' && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>
            Glassmorphism is most visible on dark palettes.
          </p>
        )}
      </div>

    </div>
  </section>
)}

      {activeTab === 'github' && (
        <GitHubTab
          config={config}
          setConfig={setConfig}
          addToast={addToast}
          onRefreshData={onRefreshData}
        />
      )}

      {activeTab === 'twitter' && (
        <section>
          <h2>Twitter / X Auth Token</h2>
          <div className="card">
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Paste your <code>auth_token</code> cookie from twitter.com DevTools (Application → Cookies).
              This is used by the opportunity radar to fetch tweets. Token is stored in your account only.
            </p>
            <div className="form-group">
              <label>auth_token</label>
              <input
                type="password"
                value={twitterToken}
                onChange={(e) => setTwitterToken(e.target.value)}
                placeholder="Paste auth_token value here"
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <div className="actions">
              <button className="primary" onClick={handleSaveTwitterToken} disabled={twitterSaving}>
                {twitterSaving ? 'Saving…' : 'Save Token'}
              </button>
              {twitterToken && (
                <button onClick={async () => {
                  setTwitterToken('')
                  const { data: { user } } = await supabase.auth.getUser()
                  await supabase.from('user_configs').upsert({ user_id: user.id, twitter_auth_token: null }, { onConflict: 'user_id' })
                  addToast('Twitter token cleared', 'success')
                }}>Clear</button>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'behavior' && usage && (
        <section>
          <h2>Usage this month</h2>
          <div className="card usage-card">
            {/* Shown as plain numbers, not charts: at this scale a chart would
                dress up a single data point. Limits come from src/lib/limits.js. */}
            <UsageMeter
              tier={usage.tier}
              used={usage.window?.calls ?? 0}
              resetsAt={usage.window?.resetsAt}
            />
            <div className="usage-row">
              <span>AI calls (this month)</span>
              <span>
                {usage.rows.reduce((n, r) => n + Number(r.calls ?? 0), 0)}

              </span>
            </div>
            <div className="usage-row">
              <span>Storage</span>
              <span>
                {formatBytes(usage.bytes)}
                <span className="usage-limit"> / {describeLimit(usage.tier, 'storageBytes')}</span>
              </span>
            </div>
            <div className="usage-row">
              <span>Feed sources</span>
              <span className="usage-limit">up to {describeLimit(usage.tier, 'feeds')}</span>
            </div>
            <p className="muted usage-note">
              Plan: <strong>{usage.tier}</strong>. AI limits are unset while usage is being
              measured — see docs/metering-scope.md.
            </p>
          </div>
        </section>
      )}

      {activeTab === 'behavior' && (
        <section>
          <h3 className="section-label">Behavior</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={archiveToast ?? true}
              onChange={(e) => onToggleArchiveToast(e.target.checked)}
            />
            Show undo notification when archiving done entries (3 seconds)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={trashToast ?? true}
              onChange={(e) => onToggleTrashToast(e.target.checked)}
            />
            Show undo notification when moving entries to trash (5 seconds)
          </label>
          {onToggleAssistant && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginTop: 10 }}>
              <input
                type="checkbox"
                checked={assistantEnabled ?? true}
                onChange={(e) => onToggleAssistant(e.target.checked)}
              />
              Enable “Ask your library” assistant (⌘/ to open)
            </label>
          )}
        </section>
      )}

      {activeTab === 'tags' && (
        <section>
          <h3 className="section-label">Tag Colors</h3>
          {allTags.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No tags yet.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allTags.map(tag => (
              <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13, padding: '2px 8px', borderRadius: 5, background: tag.color || 'var(--surface-3)' }}>#{tag.name}</span>
                <input
                  type="color"
                  value={pendingColors[tag.name] ?? tag.color ?? '#e8e3d8'}
                  onChange={(e) => setPendingColors(prev => ({ ...prev, [tag.name]: e.target.value }))}
                  onBlur={(e) => { const c = e.target.value; if (c !== (tag.color || '#e8e3d8')) onUpdateTagColor(tag.name, c) }}
                  style={{ width: 32, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                />
                <button style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => onUpdateTagColor(tag.name, null)}>✕</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'companies' && <CompaniesTab supabase={supabase} addToast={addToast} />}
      {activeTab === 'keywords' && <KeywordsTab supabase={supabase} addToast={addToast} />}
      {activeTab === 'programs' && <ProgramsTab supabase={supabase} addToast={addToast} />}

      {activeTab === 'bookmarklet' && (
        <section>
          <h2>Bookmarklet</h2>
          <div className="card">
            <p className="muted">
              A bookmark whose address is code instead of a web page. Click it while reading
              anything on the web and the page is saved to your Inbox — no need to open MediaLog.
            </p>

            <h3 className="section-label" style={{ marginTop: 20 }}>Install</h3>
            <ol style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
              <li>Go to <button className="linklike" onClick={() => setTab('tokens')}>Capture tokens</button> and create a token.</li>
              <li>Press <strong>copy bookmarklet</strong> on the token that appears.</li>
              <li>Make a new bookmark in your browser (right-click the bookmarks bar → Add page).</li>
              <li>Name it anything; paste the copied code as the <strong>URL</strong>.</li>
              <li>Click it on any page — a “Saved” badge confirms it worked.</li>
            </ol>

            {/* The code can only be produced when a token is minted: only the SHA-256
                hash is stored, so there is nothing here to regenerate it from. */}
            <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
              The code embeds your capture token, so it can only be generated at the moment a
              token is created — only a hash is kept afterwards. Lost it? Revoke that token and
              make a new one; it takes a few seconds.
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              Treat the code like a password: anything holding it can save entries to your Inbox.
              A bookmarklet runs inside whatever page you click it on, so if you ever click it
              somewhere sketchy, revoke the token.
            </p>
          </div>
        </section>
      )}

      {activeTab === 'mobile' && (
        <section>
          <h2>iOS Shortcut</h2>
          <div className="card">
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Create an iOS Shortcut to share any Safari page directly to your MediaLog inbox.
              In the Shortcuts app, create a new shortcut with these actions:
            </p>
            <ol style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 20, marginBottom: 16 }}>
              <li>Receive input from <strong>Share Sheet</strong> (input type: URLs)</li>
              <li>Get URLs from <em>Shortcut Input</em></li>
              <li>Get Name of <em>Shortcut Input</em></li>
              <li>Get Contents of URL → Method: POST, Headers: <code>Content-Type: application/json</code>, Body: JSON (see below)</li>
              <li>Show Result (optional — confirms it saved)</li>
            </ol>
            <div className="form-group">
              <label>Capture Endpoint</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value="https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/capture" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                <button onClick={() => { navigator.clipboard.writeText('https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/capture'); addToast('Copied', 'success') }} style={{ flexShrink: 0 }}>Copy</button>
              </div>
            </div>
            <div className="form-group">
              <label>Request body</label>
              <textarea
                readOnly
                rows={3}
                style={{ fontFamily: 'monospace', fontSize: 11, resize: 'none' }}
                value={'{"token":"YOUR_TOKEN","url":"[URLs]","note":"[Name]"}'}
              />
              <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Get the filled-in version from{' '}
                <button className="linklike" onClick={() => setTab('tokens')}>Capture tokens</button>
                {' '}— press <strong>copy shortcut JSON</strong> when you create a token. Replace{' '}
                <code>[URLs]</code> and <code>[Name]</code> with the Shortcuts variables of the
                same name.
              </p>
            </div>
          </div>
          {captureLog !== null && (
            <div style={{ marginTop: 24 }}>
              <h3 className="section-label">Recent Captures</h3>
              {captureLog.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>No captures yet.</p>
              ) : (
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <tbody>
                    {captureLog.map((row) => {
                      const d = new Date(row.created_at)
                      const label = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      let domain = row.url
                      try { domain = new URL(row.url).hostname } catch {}
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 0', width: 16 }}>
                            <span style={{ color: row.ok ? 'var(--success, #38a169)' : 'var(--error, #e53e3e)', fontSize: 10 }}>
                              {row.ok ? '●' : '✕'}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <a href={row.url} target="_blank" rel="noreferrer" style={{ color: 'var(--fg)' }}>{domain}</a>
                          </td>
                          <td style={{ padding: '6px 0', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{label}</td>
                          {!row.ok && (
                            <td style={{ padding: '6px 0 6px 8px', color: 'var(--error, #e53e3e)' }}>{row.message}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === 'instagram' && (
        <section>
          <h2>Instagram Reels</h2>
          <div className="card">
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Reels sent to your Instagram DMs are automatically fetched every 15 minutes and saved to your MediaLog inbox.
              No configuration is needed here — setup is done once via Supabase secrets.
            </p>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Setup (one-time)</h3>
            <ol style={{ fontSize: 13, lineHeight: 1.9, paddingLeft: 20, marginBottom: 0 }}>
              <li>Set <code>CRON_SECRET</code> in Supabase Secrets dashboard (same value as your existing cron secret) — the fetch-reels function will reject calls without it</li>
              <li>Deploy the edge function:<br /><code style={{ fontSize: 11 }}>npx supabase functions deploy fetch-reels --no-verify-jwt</code></li>
              <li>Apply the cron migration:<br /><code style={{ fontSize: 11 }}>npx supabase db push</code></li>
              <li>
                Set your Instagram session cookie (from instagram.com DevTools → Application → Cookies → <code>sessionid</code>):<br />
                <code style={{ fontSize: 11 }}>npx supabase secrets set INSTAGRAM_SESSION_ID=&lt;value&gt;</code>
              </li>
              <li>Your existing <code>GEMINI_API_KEY</code> secret is reused for caption summarization — no additional API key needed</li>
              <li>Set your Supabase user ID (from Auth dashboard):<br /><code style={{ fontSize: 11 }}>npx supabase secrets set CAPTURE_USER_ID=&lt;uuid&gt;</code></li>
            </ol>
            <p className="muted" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
              <strong>Note:</strong> The <code>sessionid</code> cookie expires periodically. If reels stop appearing, re-run the <code>secrets set</code> command with a fresh value from DevTools.
            </p>
          </div>
        </section>
      )}

      {activeTab === 'keybinds' && <KeybindsTab />}
      {activeTab === 'modules' && <ModulesTab supabase={supabase} addToast={addToast} />}
      {activeTab === 'tokens' && <CaptureTokensTab supabase={supabase} addToast={addToast} />}

      {activeTab === 'behavior' && <section style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, marginTop: 0 }}>Bulk archive to Wayback Machine</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Submits all URLs in a topic to archive.org one at a time, with a 5-second gap to stay within rate limits.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
          <select
            className="explore-filter-select"
            value={bulkTopic}
            onChange={(e) => setBulkTopic(e.target.value)}
            disabled={bulkRunning}
          >
            <option value="">Select a topic…</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={skipSubmitted}
              onChange={(e) => setSkipSubmitted(e.target.checked)}
              disabled={bulkRunning}
            />
            Skip already submitted entries
          </label>

          {!bulkRunning && (
            <button
              className="btn-small"
              onClick={handleBulkArchive}
              disabled={!bulkTopic}
              style={{ alignSelf: 'flex-start' }}
            >
              Start archiving
            </button>
          )}

          {bulkRunning && bulkProgress && (
            <>
              <div style={{ fontSize: 13 }}>
                {bulkProgress.done} / {bulkProgress.total} submitted
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    background: 'var(--accent)',
                    height: '100%',
                    width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {bulkPaused ? (
                  <button className="btn-small" onClick={handleResume}>Resume</button>
                ) : (
                  <button className="btn-small btn-ghost" onClick={handlePause}>Pause</button>
                )}
                <button className="btn-small btn-ghost" onClick={handleCancel}>Cancel</button>
              </div>
            </>
          )}

          {!bulkRunning && bulkProgress && bulkProgress.done === bulkProgress.total && (
            <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0 }}>
              Done — {bulkProgress.total} URLs submitted.
              {bulkProgress.errors.length > 0 && (
                <> {bulkProgress.errors.length} failed: {bulkProgress.errors.join(', ')}</>
              )}
            </p>
          )}
        </div>
      </section>}

    </div>
  )
}
