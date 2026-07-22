import { SYNC_TABLES, buildFiles, summarize } from '../githubSync.js'

// Reading and restoring the tables that make up a backup. Every query runs
// through the user's own client, so RLS — not this file — decides what is
// visible. That means a backup can only ever contain the caller's own rows.

const PAGE = 1000

async function readAll(supabase, table) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

/** Read every synced table into a snapshot ready for buildFiles(). */
export async function collectSnapshot(supabase, onProgress) {
  const tables = {}
  for (const table of SYNC_TABLES) {
    onProgress?.(table)
    tables[table] = await readAll(supabase, table)
  }
  return { exported_at: new Date().toISOString(), tables }
}

/**
 * Restore a snapshot. Rows are upserted BY PRIMARY KEY, so restoring twice is
 * a no-op instead of duplicating the library — the old pull path re-inserted
 * everything and multiplied entries on every run.
 *
 * Nothing is deleted: a restore can only add rows back or update them in place.
 */
export async function applySnapshot(supabase, snapshot, onProgress) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const applied = {}
  for (const table of SYNC_TABLES) {
    const rows = snapshot.tables?.[table] ?? []
    applied[table] = 0
    if (!rows.length) continue
    onProgress?.(table)

    // Re-stamp ownership: a backup restored into a different account must land
    // on that account, never carry the old user_id across.
    const owned = rows.map((r) => ('user_id' in r ? { ...r, user_id: user.id } : r))
    // entry_tags is keyed by the pair, not a surrogate id.
    const onConflict = table === 'entry_tags'
      ? 'entry_id,tag_id'
      : table === 'opportunity_state'
        ? 'user_id,opportunity_id'
        : 'id'

    for (let i = 0; i < owned.length; i += 500) {
      const batch = owned.slice(i, i + 500)
      const { error } = await supabase.from(table).upsert(batch, { onConflict, ignoreDuplicates: false })
      if (error) throw new Error(`${table}: ${error.message}`)
      applied[table] += batch.length
    }
  }
  return applied
}

/**
 * Collect, render and commit a backup. Shared by the Settings button and the
 * background auto-backup so the two can never take different paths — the
 * auto-backup previously called an action that no longer existed and, because
 * it swallows its errors, failed silently.
 */
export async function runBackup(supabase, { message, onProgress } = {}) {
  const snapshot = await collectSnapshot(supabase, onProgress)
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

  const { data: { user } } = await supabase.auth.getUser()
  await supabase
    .from('user_configs')
    .update({ last_backup_sha: data.sha, last_backup_summary: counts })
    .eq('user_id', user.id)

  return { ...data, counts }
}
