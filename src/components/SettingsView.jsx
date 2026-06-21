import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { submitArchive } from '../lib/wayback.js'
import { listEntriesByTopic, updateEntry } from '../lib/db/entries.js'
import CompaniesTab from './settings/CompaniesTab.jsx'
import KeywordsTab from './settings/KeywordsTab.jsx'
import ProgramsTab from './settings/ProgramsTab.jsx'

export default function SettingsView({ topics, onRefreshData, addToast, allTags = [], onUpdateTagColor, archiveToast, onToggleArchiveToast, trashToast, onToggleTrashToast }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingColors, setPendingColors] = useState({})
  const [tab, setTab] = useState('github')
  const [twitterToken, setTwitterToken] = useState('')
  const [twitterSaving, setTwitterSaving] = useState(false)
  const [bulkTopic, setBulkTopic] = useState('')
  const [skipSubmitted, setSkipSubmitted] = useState(true)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkPaused, setBulkPaused] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null)
  const bulkPausedRef = useRef(false)
  const bulkCancelledRef = useRef(false)

  useEffect(() => {
    loadConfig()
  }, [])

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

  async function handleConnect() {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID 
    if (!clientId) {
      alert('VITE_GITHUB_CLIENT_ID not set in .env')
      return
    }
    const scope = 'repo'
    const redirectUri = `${window.location.origin}/settings`
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}`
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('user_configs')
      .update({
        repo_name: config.repo_name,
        is_private: config.is_private,
        auto_backup: config.auto_backup,
      })
      .eq('user_id', config.user_id)
    
    if (error) addToast(`Error: ${error.message}`, 'error')
    else addToast('Settings saved', 'success')
    setSaving(false)
  }

  async function handleBackup() {
    addToast('Preparing backup...', 'info')
    try {
      // 1. Decrypt token (via Edge Function or just fetch it if you trust RLS)
      // For simplicity in this prototype, we'll assume the client can fetch the token 
      // (Security Note: In production, decryption should happen server-side)
      
      // Since we encrypted it in the Edge Function, we need a way to decrypt it.
      // I will add a 'github-backup' Edge Function later, but for now let's 
      // assume we need to call an Edge Function to perform the actual push
      // to keep the token secret.
      
      const { data, error } = await supabase.functions.invoke('github-backup', {
        body: { action: 'push' }
      })
      
      if (error) throw error
      addToast(`Backup successful! Commit: ${data.sha.slice(0, 7)}`, 'success')
      loadConfig()
    } catch (err) {
      addToast(`Backup failed: ${err.message}`, 'error')
    }
  }

  async function handleRestore() {
    if (!confirm('This will pull all data from GitHub. Duplicate entries might be created. Continue?')) return
    addToast('Restoring from GitHub...', 'info')
    try {
      const { data, error } = await supabase.functions.invoke('github-backup', {
        body: { action: 'pull' }
      })
      
      if (error) throw error
      
      // Data processing would happen here or in the Edge Function
      addToast(`Restore complete! Imported ${data.count} items.`, 'success')
      onRefreshData()
    } catch (err) {
      addToast(`Restore failed: ${err.message}`, 'error')
    }
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

  const TABS = [
    { id: 'github',      label: 'GitHub' },
    { id: 'twitter',     label: 'Twitter' },
    { id: 'behavior',    label: 'Behavior' },
    { id: 'tags',        label: 'Tag Colors' },
    { id: 'companies',   label: 'Companies' },
    { id: 'keywords',    label: 'Keywords' },
    { id: 'programs',    label: 'Programs' },
    { id: 'bookmarklet', label: 'Bookmarklet' },
    { id: 'mobile',      label: 'iOS Shortcut' },
    { id: 'instagram',   label: 'Instagram' },
  ]

  return (
    <div className="settings-view">
      <div className="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`settings-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'github' && (
        <section>
          <h2>GitHub Backup</h2>
          {!config?.github_user ? (
            <div className="card">
              <p className="muted">Connect your GitHub account to enable automatic backups in Markdown format.</p>
              <button onClick={handleConnect}>Connect GitHub</button>
            </div>
          ) : (
            <div className="card">
              <p>Connected as <strong>{config.github_user}</strong></p>
              <div className="form-group">
                <label>Repository Name</label>
                <input type="text" value={config.repo_name} onChange={e => setConfig({...config, repo_name: e.target.value})} />
              </div>
              <div className="form-group inline">
                <label>
                  <input type="checkbox" checked={config.is_private} onChange={e => setConfig({...config, is_private: e.target.checked})} />
                  Private Repository
                </label>
              </div>
              <div className="form-group inline">
                <label>
                  <input type="checkbox" checked={config.auto_backup} onChange={e => setConfig({...config, auto_backup: e.target.checked})} />
                  Automatic Backups
                </label>
              </div>
              <div className="actions">
                <button className="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
                <button onClick={handleBackup}>Backup Now</button>
                <button className="danger" onClick={handleRestore}>Restore from GitHub</button>
              </div>
              {config.last_backup_at && (
                <p className="muted" style={{ marginTop: '1rem' }}>
                  Last backup: {new Date(config.last_backup_at).toLocaleString()}
                </p>
              )}
              <p className="backup-note">
                <strong>Note:</strong> The GitHub backup contains your entry text and metadata only.
                File attachments are stored in Supabase storage and are <em>not</em> committed to git.
              </p>
            </div>
          )}
        </section>
      )}

      {tab === 'twitter' && (
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

      {tab === 'behavior' && (
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
        </section>
      )}

      {tab === 'tags' && (
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

      {tab === 'companies' && <CompaniesTab supabase={supabase} />}
      {tab === 'keywords' && <KeywordsTab supabase={supabase} />}
      {tab === 'programs' && <ProgramsTab supabase={supabase} />}

      {tab === 'bookmarklet' && (
        <section>
          <h2>Bookmarklet</h2>
          <div className="card">
            <p className="muted">Drag the link below to your bookmarks bar. Click on any page to save it to your MediaLog inbox.</p>
            {!import.meta.env.VITE_CAPTURE_SECRET ? (
              <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 6, marginTop: 16, marginBottom: 16 }}>
                <p style={{ fontSize: 13, margin: 0, color: 'var(--text-secondary)' }}>
                  <strong>Setup required:</strong> Add <code>VITE_CAPTURE_SECRET</code> to your <code>.env.local</code> file with the same value as your <code>CAPTURE_SECRET</code> Supabase secret.
                </p>
              </div>
            ) : (
              (() => {
                const bookmarkletCode = `(function(){var url=location.href;var title=document.title;fetch('${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:'${import.meta.env.VITE_CAPTURE_SECRET}',url:url,note:title})}).then(function(r){alert(r.ok?'Saved to MediaLog ✓':'Failed: '+r.status)}).catch(function(){alert('MediaLog: network error')})})()`
                return (
                  <>
                    <div style={{ marginTop: 16, marginBottom: 16 }}>
                      <a
                        href={`javascript:${bookmarkletCode}`}
                        className="bookmarklet-link"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        style={{
                          display: 'inline-block',
                          padding: '10px 16px',
                          background: 'var(--accent)',
                          color: 'var(--bg)',
                          borderRadius: 6,
                          textDecoration: 'none',
                          fontWeight: 500,
                          fontSize: 14,
                          cursor: 'move',
                          userSelect: 'none',
                        }}
                      >
                        📎 Save to MediaLog
                      </a>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`javascript:${bookmarkletCode}`)
                        addToast('Bookmarklet copied to clipboard', 'success')
                      }}
                      style={{ fontSize: 13 }}
                    >
                      Copy Bookmarklet Code
                    </button>
                  </>
                )
              })()
            )}
          </div>
        </section>
      )}

      {tab === 'mobile' && (
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
            {import.meta.env.VITE_CAPTURE_SECRET ? (
              <div className="form-group">
                <label>JSON Body (paste into "Request Body" field)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    readOnly
                    rows={3}
                    style={{ fontFamily: 'monospace', fontSize: 11, resize: 'none' }}
                    value={`{"secret":"${import.meta.env.VITE_CAPTURE_SECRET}","url":"[URLs]","note":"[Name]"}`}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(`{"secret":"${import.meta.env.VITE_CAPTURE_SECRET}","url":"[URLs]","note":"[Name]"}`); addToast('Copied', 'success') }}
                    style={{ flexShrink: 0, alignSelf: 'flex-start' }}
                  >Copy</button>
                </div>
                <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>Replace <code>[URLs]</code> and <code>[Name]</code> with the Shortcuts variables of the same name.</p>
              </div>
            ) : (
              <p style={{ color: 'var(--warning, #b45309)', fontSize: 13 }}>
                Add <code>VITE_CAPTURE_SECRET</code> to your <code>.env.local</code> to see the pre-filled JSON body.
              </p>
            )}
          </div>
        </section>
      )}

      {tab === 'instagram' && (
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
              <li>Set your Anthropic API key (used for caption tagging):<br /><code style={{ fontSize: 11 }}>npx supabase secrets set ANTHROPIC_API_KEY=&lt;key&gt;</code></li>
              <li>Set your Supabase user ID (from Auth dashboard):<br /><code style={{ fontSize: 11 }}>npx supabase secrets set CAPTURE_USER_ID=&lt;uuid&gt;</code></li>
            </ol>
            <p className="muted" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
              <strong>Note:</strong> The <code>sessionid</code> cookie expires periodically. If reels stop appearing, re-run the <code>secrets set</code> command with a fresh value from DevTools.
            </p>
          </div>
        </section>
      )}

      <section style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
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
      </section>

    </div>
  )
}
