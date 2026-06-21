import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import CompaniesTab from './settings/CompaniesTab.jsx'
import KeywordsTab from './settings/KeywordsTab.jsx'
import ProgramsTab from './settings/ProgramsTab.jsx'

export default function SettingsView({ topics, onRefreshData, addToast, allTags = [], onUpdateTagColor, archiveToast, onToggleArchiveToast }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingColors, setPendingColors] = useState({})
  const [tab, setTab] = useState('github')

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
    if (data) setConfig(data)
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

  if (loading) return <p>Loading settings...</p>

  const TABS = [
    { id: 'github',    label: 'GitHub' },
    { id: 'behavior',  label: 'Behavior' },
    { id: 'tags',      label: 'Tag Colors' },
    { id: 'companies', label: 'Companies' },
    { id: 'keywords',  label: 'Keywords' },
    { id: 'programs',  label: 'Programs' },
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

      <style dangerouslySetInnerHTML={{ __html: `
        .settings-view { max-width: 700px; margin: 0 auto; padding: 2rem; }
        .card { background: var(--bg-card); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
        .form-group.inline label { display: flex; align-items: center; gap: 0.5rem; font-weight: 400; cursor: pointer; }
        .form-group input[type="text"] { width: 100%; }
        .actions { display: flex; gap: 1rem; margin-top: 2rem; }
        .section-label { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }
      `}} />
    </div>
  )
}
