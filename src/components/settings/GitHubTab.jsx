import { useState } from 'react'
import { GitBranch, Check, RefreshCw, Download, Upload, AlertTriangle, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient.js'
import { buildFiles, parseFiles, summarize, SYNC_TABLES, EXCLUDED_TABLES } from '../../lib/githubSync.js'
import { collectSnapshot, applySnapshot } from '../../lib/db/githubBackup.js'

const TABLE_LABEL = {
  topics: 'topics',
  entries: 'entries',
  tags: 'tags',
  entry_tags: 'entry tags',
  entry_versions: 'note history',
  highlights: 'highlights',
  resource_sections: 'reading sections',
  feeds: 'feeds',
  applications: 'applications',
  opportunity_state: 'opportunity state',
}

function CountGrid({ counts }) {
  return (
    <ul className="gh-counts">
      {SYNC_TABLES.map((t) => (
        <li key={t} className={counts[t] ? '' : 'gh-count--empty'}>
          <span className="gh-count-n">{counts[t] ?? 0}</span>
          <span className="gh-count-label">{TABLE_LABEL[t] ?? t}</span>
        </li>
      ))}
    </ul>
  )
}

export default function GitHubTab({ config, setConfig, addToast, onRefreshData }) {
  const [repos, setRepos] = useState(null)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [busy, setBusy] = useState(null) // 'backup' | 'restore' | null
  const [progress, setProgress] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [pendingRestore, setPendingRestore] = useState(null)

  const connected = Boolean(config?.github_user)

  function handleConnect() {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
    if (!clientId) {
      addToast('VITE_GITHUB_CLIENT_ID is not set — add it to .env.local', 'error')
      return
    }
    const redirectUri = `${window.location.origin}/settings`
    window.location.href =
      `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}`
  }

  async function call(action, body = {}) {
    const { data, error } = await supabase.functions.invoke('github-backup', {
      body: { action, ...body },
    })
    if (error) throw new Error(data?.error || error.message)
    if (data?.error) throw new Error(data.error)
    return data
  }

  async function loadRepos() {
    setLoadingRepos(true)
    try {
      setRepos((await call('repos')).repos)
    } catch (e) {
      addToast(`Could not list repositories: ${e.message}`, 'error')
    }
    setLoadingRepos(false)
  }

  async function saveConfig(patch) {
    const next = { ...config, ...patch }
    setConfig(next)
    const { error } = await supabase
      .from('user_configs')
      .update({
        repo_name: next.repo_name,
        repo_branch: next.repo_branch || 'main',
        is_private: next.is_private,
        auto_backup: next.auto_backup,
      })
      .eq('user_id', config.user_id)
    if (error) addToast(`Could not save: ${error.message}`, 'error')
  }

  async function handleBackup() {
    setBusy('backup')
    setLastResult(null)
    try {
      setProgress('reading your library…')
      const snapshot = await collectSnapshot(supabase, (t) => setProgress(`reading ${TABLE_LABEL[t] ?? t}…`))
      const counts = summarize(snapshot)
      const files = buildFiles(snapshot)

      setProgress(`committing ${files.length} files…`)
      const res = await call('commit', {
        files,
        message: `MediaLog backup — ${new Date().toISOString().slice(0, 10)}`,
      })

      await supabase
        .from('user_configs')
        .update({ last_backup_sha: res.sha, last_backup_summary: counts })
        .eq('user_id', config.user_id)
      setConfig({
        ...config,
        last_backup_at: new Date().toISOString(),
        last_backup_sha: res.sha,
        last_backup_summary: counts,
      })

      setLastResult({ kind: 'backup', counts, ...res })
      addToast(res.unchanged ? 'Already up to date — nothing changed' : `Backed up to ${res.sha.slice(0, 7)}`, 'success')
    } catch (e) {
      addToast(`Backup failed: ${e.message}`, 'error')
    }
    setProgress(null)
    setBusy(null)
  }

  // Restore is two steps on purpose: fetch and show what is in the repo, then
  // let the user confirm. Writing to the library on one click is how people
  // lose an afternoon of work to a stale backup.
  async function handlePreviewRestore() {
    setBusy('restore')
    try {
      setProgress('reading the repository…')
      const { files } = await call('fetch')
      const snapshot = parseFiles(files)
      setPendingRestore({ snapshot, counts: summarize(snapshot) })
    } catch (e) {
      addToast(`Could not read backup: ${e.message}`, 'error')
    }
    setProgress(null)
    setBusy(null)
  }

  async function handleConfirmRestore() {
    setBusy('restore')
    try {
      const applied = await applySnapshot(
        supabase,
        pendingRestore.snapshot,
        (t) => setProgress(`restoring ${TABLE_LABEL[t] ?? t}…`),
      )
      setPendingRestore(null)
      setLastResult({ kind: 'restore', counts: applied })
      addToast('Restore complete', 'success')
      onRefreshData?.()
    } catch (e) {
      addToast(`Restore failed: ${e.message}`, 'error')
    }
    setProgress(null)
    setBusy(null)
  }

  if (!connected) {
    return (
      <section>
        <h2>GitHub sync</h2>
        <div className="card gh-connect">
          <GitBranch size={28} />
          <div>
            <p className="gh-connect-lead">Keep a complete copy of your library in a repository you own.</p>
            <p className="muted">
              Every backup writes your rows as JSON and your notes as readable markdown, in one commit.
              Your data stays yours even if MediaLog goes away.
            </p>
          </div>
          <button className="primary" onClick={handleConnect}>Connect GitHub</button>
        </div>
      </section>
    )
  }

  const repoUrl = `https://github.com/${config.github_user}/${config.repo_name}`

  return (
    <section className="gh-tab">
      <h2>GitHub sync</h2>

      <div className="card">
        <div className="gh-status">
          <Check size={15} className="gh-ok" />
          <span>Connected as <strong>{config.github_user}</strong></span>
        </div>

        <div className="form-group">
          <label>Repository</label>
          <div className="gh-repo-row">
            <input
              type="text"
              value={config.repo_name ?? ''}
              onChange={(e) => setConfig({ ...config, repo_name: e.target.value })}
              onBlur={(e) => saveConfig({ repo_name: e.target.value })}
              placeholder="medialog-backup"
            />
            <button onClick={loadRepos} disabled={loadingRepos}>
              {loadingRepos ? 'loading…' : repos ? 'refresh' : 'browse…'}
            </button>
          </div>
          {repos && (
            <select
              className="gh-repo-select"
              value=""
              onChange={(e) => { if (e.target.value) saveConfig({ repo_name: e.target.value }) }}
            >
              <option value="">pick an existing repository…</option>
              {repos.map((r) => (
                <option key={r.full_name} value={r.name}>
                  {r.name}{r.private ? ' (private)' : ''}
                </option>
              ))}
            </select>
          )}
          <p className="gh-hint muted">
            Created automatically if it doesn’t exist yet.{' '}
            <a href={repoUrl} target="_blank" rel="noopener noreferrer">
              {config.github_user}/{config.repo_name} <ExternalLink size={11} />
            </a>
          </p>
        </div>

        <div className="form-group">
          <label>Branch</label>
          <input
            type="text"
            value={config.repo_branch ?? 'main'}
            onChange={(e) => setConfig({ ...config, repo_branch: e.target.value })}
            onBlur={(e) => saveConfig({ repo_branch: e.target.value })}
            placeholder="main"
          />
        </div>

        <div className="form-group inline">
          <label>
            <input
              type="checkbox"
              checked={config.is_private !== false}
              onChange={(e) => saveConfig({ is_private: e.target.checked })}
            />
            Private repository
          </label>
        </div>

        <div className="actions">
          <button className="primary" onClick={handleBackup} disabled={busy}>
            <Upload size={13} /> {busy === 'backup' ? 'backing up…' : 'Back up now'}
          </button>
          <button onClick={handlePreviewRestore} disabled={busy}>
            <Download size={13} /> Restore from GitHub
          </button>
        </div>

        {progress && (
          <p className="gh-progress"><RefreshCw size={12} className="gh-spin" /> {progress}</p>
        )}

        {config.last_backup_at && !progress && (
          <p className="muted gh-last">
            Last backup {new Date(config.last_backup_at).toLocaleString()}
            {config.last_backup_sha && (
              <>
                {' · '}
                <a href={`${repoUrl}/commit/${config.last_backup_sha}`} target="_blank" rel="noopener noreferrer">
                  {config.last_backup_sha.slice(0, 7)}
                </a>
              </>
            )}
          </p>
        )}
      </div>

      {lastResult && (
        <div className="card">
          <h3 className="gh-card-title">
            {lastResult.kind === 'backup'
              ? (lastResult.unchanged ? 'Already up to date' : 'Backed up')
              : 'Restored'}
          </h3>
          <CountGrid counts={lastResult.counts} />
        </div>
      )}

      {pendingRestore && (
        <div className="card gh-restore">
          <h3 className="gh-card-title">
            <AlertTriangle size={15} /> Restore this backup?
          </h3>
          <p className="muted">
            Taken {new Date(pendingRestore.snapshot.exported_at).toLocaleString()}. Rows are matched by
            id, so anything already in your library is updated in place rather than duplicated.
            Nothing is deleted — entries you added since this backup stay.
          </p>
          <CountGrid counts={pendingRestore.counts} />
          <div className="actions">
            <button className="danger" onClick={handleConfirmRestore} disabled={busy}>
              {busy === 'restore' ? 'restoring…' : 'Restore'}
            </button>
            <button onClick={() => setPendingRestore(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="gh-card-title">What a backup contains</h3>
        <p className="muted gh-hint">
          <code>data/*.json</code> — the exact rows, used to restore.{' '}
          <code>notes/</code> — the same entries as markdown, one file per entry, readable on GitHub.
        </p>
        <ul className="gh-excluded">
          {Object.entries(EXCLUDED_TABLES).map(([table, why]) => (
            <li key={table}><code>{table}</code> — not included; {why}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
