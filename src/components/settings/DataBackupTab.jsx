import { useRef, useState } from 'react'
import { GitBranch, Check, RefreshCw, Download, Upload, AlertTriangle, ExternalLink, FileArchive, FileDown } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient.js'
import { beginGitHubOAuth } from '../../lib/captureOAuthCode.js'
import { parseFiles, summarize, SYNC_TABLES, EXCLUDED_TABLES, DEFAULT_REPO_NAME } from '../../lib/githubSync.js'
import { applySnapshot, runBackup } from '../../lib/db/githubBackup.js'
import { disconnectGitHub, clearBackupError, updateBackupSettings, DISCONNECTED_GITHUB_FIELDS } from '../../lib/db/userConfig.js'
import { downloadBackupZip, readBackupZip, applyBackupZip } from '../../lib/db/zipBackup.js'
import MigrationView from '../MigrationView.jsx'

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
  user_configs: 'preferences',
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

// Local zip backup — no GitHub connection required. Same data/*.json format
// buildFiles() already produces, just downloaded instead of committed.
function LocalBackupSection({ addToast, onRefreshData }) {
  const [busy, setBusy] = useState(null) // 'export' | 'import' | null
  const [progress, setProgress] = useState(null)
  const [pendingImport, setPendingImport] = useState(null)
  const [lastImport, setLastImport] = useState(null)
  const fileInputRef = useRef(null)

  async function handleDownload() {
    setBusy('export')
    try {
      await downloadBackupZip(supabase, (step) => setProgress(`${step}…`))
      addToast('Backup downloaded', 'success')
    } catch (e) {
      addToast(`Backup failed: ${e.message}`, 'error')
    }
    setProgress(null)
    setBusy(null)
  }

  function handlePickFile() {
    fileInputRef.current?.click()
  }

  async function handleFileChosen(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setBusy('import')
    setLastImport(null)
    try {
      const snapshot = await readBackupZip(file)
      setPendingImport({ snapshot, counts: summarize(snapshot) })
    } catch (err) {
      addToast(`Could not read backup: ${err.message}`, 'error')
    }
    setBusy(null)
  }

  async function handleConfirmImport() {
    setBusy('import')
    try {
      const applied = await applyBackupZip(
        supabase,
        pendingImport.snapshot,
        (t) => setProgress(`restoring ${TABLE_LABEL[t] ?? t}…`),
      )
      setPendingImport(null)
      setLastImport(applied)
      addToast('Import complete', 'success')
      onRefreshData?.()
    } catch (e) {
      addToast(`Import failed: ${e.message}`, 'error')
    }
    setProgress(null)
    setBusy(null)
  }

  return (
    <div className="card">
      <h3 className="gh-card-title">Manual backup &amp; restore</h3>
      <p className="muted gh-hint">
        Works with no setup and no network. Download a zip of everything below, or restore
        from one — after deleting your account, moving to a new one, or just as a copy
        that lives outside GitHub.
      </p>
      {/* Restore carries the same weight as export on purpose: it is the one
          you reach for under pressure, and it used to read as the lesser button. */}
      <div className="actions">
        <button className="primary" onClick={handleDownload} disabled={busy}>
          <Download size={13} /> {busy === 'export' ? 'zipping…' : 'Download zip'}
        </button>
        <button className="primary" onClick={handlePickFile} disabled={busy}>
          <FileArchive size={13} /> {busy === 'import' ? 'reading…' : 'Restore from zip'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileChosen}
          style={{ display: 'none' }}
        />
      </div>

      {progress && (
        <p className="gh-progress"><RefreshCw size={12} className="gh-spin" /> {progress}</p>
      )}

      {pendingImport && (
        <div className="card gh-restore">
          <h3 className="gh-card-title">
            <AlertTriangle size={15} /> Import this backup?
          </h3>
          <p className="muted">
            Taken {new Date(pendingImport.snapshot.exported_at).toLocaleString()}. Rows are matched by
            id, so anything already in your library is updated in place rather than duplicated.
            Nothing is deleted. Any public share links in this backup are restored inactive —
            re-enable them individually afterward.
          </p>
          <CountGrid counts={pendingImport.counts} />
          <div className="actions">
            <button className="danger" onClick={handleConfirmImport} disabled={busy}>
              {busy === 'import' ? 'importing…' : 'Import'}
            </button>
            <button onClick={() => setPendingImport(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      {lastImport && !pendingImport && (
        <div className="card">
          <h3 className="gh-card-title">Imported</h3>
          <CountGrid counts={lastImport} />
        </div>
      )}
    </div>
  )
}

// Human-readable markdown export — one file per topic, no IDs, not meant to
// round-trip. For reading elsewhere (Claude Projects, Obsidian), not restore.
function MarkdownExportSection({ onExportAll, exportBusy }) {
  if (!onExportAll) return null
  return (
    <div className="card">
      <h3 className="gh-card-title">Markdown export</h3>
      <p className="muted gh-hint">
        Every topic as a readable .md file in a zip — good for reading elsewhere or dropping into
        another tool. Attachments aren't included, and this format isn't meant to be re-imported;
        use Local backup above for a restorable copy.
      </p>
      <div className="actions">
        <button onClick={onExportAll} disabled={exportBusy}>
          <FileDown size={13} /> {exportBusy ? 'exporting…' : 'Download markdown export'}
        </button>
      </div>
    </div>
  )
}

// One-time migration from another app's export format. Distinct from the
// zip backup above: this creates new inbox entries rather than restoring
// existing ones, and has no concept of round-tripping.
function ImportFromOtherAppsSection({ topics, onImportEntries, addToast }) {
  if (!onImportEntries) return null
  return (
    <div className="card">
      <h3 className="gh-card-title">Import from other apps</h3>
      <p className="muted gh-hint">
        Bring in content from Chrome tabs, Apple Notes, Google Keep, or Obsidian. Entries land in
        your inbox for triage — this is a one-time migration, not a restore.
      </p>
      <MigrationView topics={topics} onImportEntries={onImportEntries} addToast={addToast} />
    </div>
  )
}

export default function DataBackupTab({
  config, setConfig, addToast, onRefreshData, topics, onImportEntries, onExportAll, exportBusy,
}) {
  const [repos, setRepos] = useState(null)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [busy, setBusy] = useState(null) // 'backup' | 'restore' | null
  const [progress, setProgress] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [pendingRestore, setPendingRestore] = useState(null)
  const [foreignRepo, setForeignRepo] = useState(false)

  const connected = Boolean(config?.github_user)

  function handleConnect() {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
    if (!clientId) {
      addToast('VITE_GITHUB_CLIENT_ID is not set — add it to .env.local', 'error')
      return
    }
    const redirectUri = `${window.location.origin}/settings`
    // The state round-trips through GitHub and is how the callback recognises
    // its own code no matter which path the browser lands on. Also the CSRF
    // protection this flow was missing entirely.
    const state = beginGitHubOAuth()
    window.location.href =
      `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
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

  // The only way out. Without it there was no way to unlink a GitHub account
  // from the UI at all — capture tokens have had a proper revoke flow all
  // along, this had nothing. Everything account-scoped clears together;
  // leaving repo_name behind is what causes the split-brain on the next link.
  async function handleDisconnect() {
    setBusy('disconnect')
    try {
      await disconnectGitHub(supabase, config.user_id, DEFAULT_REPO_NAME)
    } catch (e) {
      setBusy(null)
      addToast(`Could not disconnect: ${e.message}`, 'error')
      return
    }
    setBusy(null)
    // The same field set the write used, so the local row and the database
    // cannot disagree about what "disconnected" means.
    setConfig({ ...config, ...DISCONNECTED_GITHUB_FIELDS(DEFAULT_REPO_NAME) })
    setRepos(null)
    addToast('GitHub disconnected. Revoke the app on GitHub too, to be thorough.', 'success')
  }

  async function clearLastError() {
    try {
      await clearBackupError(supabase, config.user_id)
      setConfig({ ...config, last_error: null })
    } catch (e) {
      // Dismissing a stale error banner is not worth a toast of its own, but the
      // banner must stay up if the clear did not land — hiding it locally would
      // make it reappear on the next reload with no explanation.
      addToast(`Could not clear the error: ${e.message}`, 'error')
    }
  }

  async function saveConfig(patch) {
    const next = { ...config, ...patch }
    setConfig(next)
    try {
      await updateBackupSettings(supabase, config.user_id, next)
    } catch (e) {
      addToast(`Could not save: ${e.message}`, 'error')
    }
  }

  async function handleBackup({ force = false } = {}) {
    setBusy('backup')
    setLastResult(null)
    try {
      const res = await runBackup(supabase, {
        force,
        onProgress: (step) => setProgress(`${TABLE_LABEL[step] ? 'reading ' + TABLE_LABEL[step] : step}…`),
      })
      setConfig({
        ...config,
        last_backup_at: new Date().toISOString(),
        last_backup_sha: res.sha,
        last_backup_summary: res.counts,
      })
      setLastResult({ kind: 'backup', ...res })
      addToast(
        res.unchanged ? 'Already up to date — nothing changed' : `Backed up ${res.uploaded} changed files`,
        'success',
      )
    } catch (e) {
      if (e.code === 'FOREIGN_BACKUP') {
        setProgress(null)
        setBusy(null)
        setForeignRepo(true)
        return
      }
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
      // Restore upserts and re-stamps user_id onto every row, so a foreign
      // backup does not replace your library — it MERGES into it, and nothing
      // afterwards can tell the two apart. Worth saying out loud before, not after.
      const foreign = Boolean(snapshot.account_id) && snapshot.account_id !== config.user_id
      setPendingRestore({ snapshot, counts: summarize(snapshot), foreign })
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
        <h2>Data & Backup</h2>
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

        <LocalBackupSection addToast={addToast} onRefreshData={onRefreshData} />
        <MarkdownExportSection onExportAll={onExportAll} exportBusy={exportBusy} />
        <ImportFromOtherAppsSection topics={topics} onImportEntries={onImportEntries} addToast={addToast} />
      </section>
    )
  }

  const repoUrl = `https://github.com/${config.github_user}/${config.repo_name}`

  return (
    <section className="gh-tab">
      <h2>Data & Backup</h2>

      <div className="card">
        <h3 className="gh-card-title">GitHub sync</h3>
        <div className="gh-status">
          <Check size={15} className="gh-ok" />
          <span>Connected as <strong>{config.github_user}</strong></span>
          <button
            className="btn-small gh-disconnect"
            onClick={handleDisconnect}
            disabled={busy === 'disconnect'}
            title="Unlink this GitHub account"
          >
            {busy === 'disconnect' ? 'disconnecting…' : 'Disconnect'}
          </button>
        </div>

        {/* Auto-backup swallows its errors by design so it never interrupts you
            mid-sentence, which also meant a backup could be broken for months
            with nothing on screen. This is the only place that reaches. */}
        {config.last_error && (
          <div className="gh-error-banner">
            <AlertTriangle size={15} />
            <span>Last backup failed: {config.last_error}</span>
            <button className="btn-small" onClick={clearLastError}>Dismiss</button>
          </div>
        )}

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

        {/* A commit replaces data/*.json wholesale, so overwriting someone
            else's backup is destructive and silent. Ask once, explicitly. */}
        {foreignRepo && (
          <div className="card gh-restore">
            <h3 className="gh-card-title">
              <AlertTriangle size={15} /> This repository belongs to another account
            </h3>
            <p className="muted">
              It already holds a MediaLog backup written by a different account. A backup
              replaces the whole <code>data/</code> folder rather than merging, so continuing
              would destroy that backup. Point this account at its own repository instead,
              unless you know the other one is yours and no longer needed.
            </p>
            <div className="actions">
              <button className="danger" onClick={() => { setForeignRepo(false); handleBackup({ force: true }) }} disabled={busy}>
                Replace it anyway
              </button>
              <button onClick={() => setForeignRepo(false)} disabled={busy}>Cancel</button>
            </div>
          </div>
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
          {pendingRestore.foreign && (
            <p className="gh-error-banner">
              <AlertTriangle size={15} />
              <span>
                This backup was written by a <strong>different MediaLog account</strong>. Restoring
                merges its entries into your library rather than replacing yours, and afterwards
                there is no way to tell which came from where.
              </span>
            </p>
          )}
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

      {/* Above the explainer, not below it. Once GitHub is connected this
          section used to sit last on a long page, which is how the zip restore
          — the one path that needs no network and no setup — went unnoticed. */}
      <LocalBackupSection addToast={addToast} onRefreshData={onRefreshData} />

      <div className="card">
        <h3 className="gh-card-title">What a GitHub backup contains</h3>
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

      <MarkdownExportSection onExportAll={onExportAll} exportBusy={exportBusy} />
      <ImportFromOtherAppsSection topics={topics} onImportEntries={onImportEntries} addToast={addToast} />
    </section>
  )
}
