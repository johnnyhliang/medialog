import { fetchAllPages } from './paginate.js'
import { unwrap } from './unwrap.js'

/**
 * The backup committed, but recording that it did failed.
 *
 * Distinct from DbError on purpose: this is the one error in the module that
 * does NOT mean "your data did not get backed up". Callers that treat every
 * throw the same will show an accurate message anyway, because the message says
 * so; callers that care can check `result` and mark the backup as done.
 */
export class BackupRecordError extends Error {
  constructor(cause, result) {
    super(`Backup committed successfully, but recording it failed: ${cause?.message ?? 'unknown error'}. Your data is safe in GitHub; the "last backup" time may be stale.`)
    this.name = 'BackupRecordError'
    this.cause = cause
    // The backup that DID succeed, so a caller need not redo it.
    this.result = result
  }
}
import { requireUser } from '../requireUser.js'
import { SYNC_TABLES, CONFLICT_TARGETS, USER_CONFIG_EXPORT_FIELDS, buildFiles, summarize } from '../githubSync.js'

// Reading and restoring the tables that make up a backup. Every query runs
// through the user's own client, so RLS — not this file — decides what is
// visible. That means a backup can only ever contain the caller's own rows.

// This file solved the 1000-row truncation first; the helper is now shared so
// the next query does not have to rediscover it. See paginate.js.
const readAll = (supabase, table) =>
  fetchAllPages((from, to) => supabase.from(table).select('*').range(from, to), table)

/**
 * The account_id recorded in the repo's manifest, or null when the repo is
 * empty, unreadable, or predates the marker. Deliberately swallows failures:
 * this guards against clobbering, and an unreadable repo must not block a
 * backup that would otherwise succeed.
 */
async function readRepoOwner(supabase) {
  try {
    // The one place in this file where dropping the error is CORRECT, so it is
    // written out rather than left implicit in a `const { data }` destructure:
    // an unreadable repo must degrade to "owner unknown", not fail the backup.
    const { data, error } = await supabase.functions.invoke('github-backup', { body: { action: 'fetch' } })
    if (error) return null
    const raw = (data?.files ?? []).find((f) => f.path === 'data/manifest.json')?.content
    return raw ? (JSON.parse(raw).account_id ?? null) : null
  } catch {
    return null
  }
}

/** Read every synced table into a snapshot ready for buildFiles(). */
export async function collectSnapshot(supabase, onProgress) {
  const tables = {}
  for (const table of SYNC_TABLES) {
    onProgress?.(table)
    tables[table] = await readAll(supabase, table)
  }

  onProgress?.('user_configs')
  const user = await requireUser(supabase)
  // maybeSingle() already returns null data for "no row", so unwrap's throw can
  // only mean the read actually failed. Silently exporting user_config:null on
  // a failed read would produce a backup that looks complete and quietly drops
  // the user's settings — the worst possible place for a swallowed error.
  const configRow = unwrap(
    await supabase
      .from('user_configs')
      .select(USER_CONFIG_EXPORT_FIELDS.join(','))
      .eq('user_id', user.id)
      .maybeSingle(),
    'collectSnapshot:user_configs'
  )
  const user_config = configRow
    ? Object.fromEntries(USER_CONFIG_EXPORT_FIELDS.map((f) => [f, configRow[f] ?? null]))
    : null

  return { exported_at: new Date().toISOString(), account_id: user.id, tables, user_config }
}

/**
 * Restore a snapshot. Rows are upserted BY PRIMARY KEY, so restoring twice is
 * a no-op instead of duplicating the library — the old pull path re-inserted
 * everything and multiplied entries on every run.
 *
 * Nothing is deleted: a restore can only add rows back or update them in place.
 */
// `source: 'zip'` marks a restore as coming from a downloaded file rather than
// the connected GitHub repo. Zip backups can be handed around (a new machine,
// a re-created account) far more casually than a private repo, so a restored
// share link is held inactive until the owner deliberately re-enables it —
// GitHub restore keeps today's live-on-restore behavior.
export async function applySnapshot(supabase, snapshot, onProgress, { source } = {}) {
  const user = await requireUser(supabase)

  const applied = {}
  for (const table of SYNC_TABLES) {
    const rows = snapshot.tables?.[table] ?? []
    applied[table] = 0
    if (!rows.length) continue
    onProgress?.(table)

    // Re-stamp ownership: a backup restored into a different account must land
    // on that account, never carry the old user_id across.
    const owned = rows.map((r) => {
      const row = 'user_id' in r ? { ...r, user_id: user.id } : { ...r }
      if (table === 'shared_items' && source === 'zip') row.active = false
      return row
    })
    const onConflict = CONFLICT_TARGETS[table] ?? 'id'

    for (let i = 0; i < owned.length; i += 500) {
      const batch = owned.slice(i, i + 500)
      const { error } = await supabase.from(table).upsert(batch, { onConflict, ignoreDuplicates: false })
      if (error) throw new Error(`${table}: ${error.message}`)
      applied[table] += batch.length
    }
  }

  if (snapshot.user_config) {
    onProgress?.('user_configs')
    // Payload carries only the allowlisted fields, so upsert cannot touch
    // github_token/repo_name/auto_backup even though they share the row.
    const { error } = await supabase
      .from('user_configs')
      .upsert({ user_id: user.id, ...snapshot.user_config }, { onConflict: 'user_id' })
    if (error) throw new Error(`user_configs: ${error.message}`)
    applied.user_configs = 1
  }

  return applied
}

/**
 * Collect, render and commit a backup. Shared by the Settings button and the
 * background auto-backup so the two can never take different paths — the
 * auto-backup previously called an action that no longer existed and, because
 * it swallows its errors, failed silently.
 */
export async function runBackup(supabase, { message, onProgress, force = false } = {}) {
  const snapshot = await collectSnapshot(supabase, onProgress)

  // A commit REPLACES data/*.json rather than merging, so backing up into a repo
  // another account owns destroys their backup silently. Check the manifest
  // first. `force` is how the UI proceeds once the user has been told.
  if (!force) {
    const owner = await readRepoOwner(supabase)
    if (owner && owner !== snapshot.account_id) {
      const err = new Error('This repository already holds a backup from a different MediaLog account. Backing up would replace it.')
      err.code = 'FOREIGN_BACKUP'
      throw err
    }
  }
  const counts = summarize(snapshot)
  const files = buildFiles(snapshot)

  onProgress?.(`committing ${files.length} files`)
  const { data, error } = await supabase.functions.invoke('github-backup', {
    body: {
      action: 'commit',
      files,
      message: message || `MediaLog backup — ${new Date().toISOString().slice(0, 10)}`,
    },
  })
  if (error) throw new Error(data?.error || error.message)
  if (data?.error) throw new Error(data.error)

  const user = await requireUser(supabase)
  // last_backup_at has existed since migration 0003 and was never written,
  // so "when did this last run?" was unanswerable and silent failure looked
  // identical to success.
  //
  // The commit has ALREADY LANDED by the time this runs, which makes the failure
  // mode here unusual: the user's data is safely in GitHub and only our note of
  // that fact failed to save. Letting the DbError propagate would make both
  // callers toast the raw cause, telling someone their backup failed when it
  // demonstrably did not — a new lie in the opposite direction, and one that
  // invites them to re-run or distrust a working backup.
  //
  // Swallowing it is equally wrong: the UI would then show a stale "last backed
  // up" beside a green tick, which is the silent-failure pattern this whole
  // sweep exists to delete.
  //
  // So it stays loud, but the message states both halves of what happened. The
  // error carries the successful result, so a caller that wants to record the
  // backup as done and merely warn about the record can do so.
  const record = await supabase
    .from('user_configs')
    .update({ last_backup_sha: data.sha, last_backup_summary: counts, last_backup_at: new Date().toISOString(), last_error: null })
    .eq('user_id', user.id)
  if (record.error) throw new BackupRecordError(record.error, { ...data, counts })

  return { ...data, counts }
}
