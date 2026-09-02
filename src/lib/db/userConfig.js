import { unwrap, unwrapList } from './unwrap.js'
import { getUserOrNull, requireUser } from '../requireUser.js'

// `user_configs` is one row per account holding three unrelated kinds of thing:
// preferences (theme, modules, timezone), authored data (radar_keywords, interview
// prep), and credentials + backup plumbing (github_token, twitter_auth_token,
// repo_name, last_backup_*). githubSync.js documents that split as an explicit
// field allowlist, because the failure directions are not symmetric — dropping a
// field loses data, carrying one can leak a credential.
//
// THE SAME ASYMMETRY APPLIES HERE, so the rule for this module is:
//
//   - a function that exists to serve ONE field selects ONLY that field
//     (`getRadarKeywords`), so the secrets are never in memory to be logged,
//     serialised into an error, or spread into some future payload;
//   - `getUserConfig` is the deliberate exception. It selects `*` because the
//     settings screen genuinely renders the whole row — the Twitter token input
//     shows its own value, and DataBackupTab branches on `github_user`. Narrowing
//     it would be a behaviour change, not a hardening, since the row is what the
//     UI is editing. It is scoped to the signed-in user by RLS *and* an explicit
//     `user_id` filter, and nothing here writes it anywhere but React state.
//
// The practical rule: do not reach for `getUserConfig` when you need one field.
// Anything derived from this row that leaves the browser must go through
// USER_CONFIG_EXPORT_FIELDS in githubSync.js, which is applied at the point bytes
// leave the system.

/**
 * The whole config row for the signed-in user, or null.
 *
 * `getUserOrNull`, not `requireUser`: SettingsView calls this on mount, where
 * being signed out is an ordinary state (the session may not have settled yet)
 * that renders as "not loaded" rather than an error. A genuine auth failure
 * still throws — that distinction is the whole point of the helper.
 *
 * Also null when the row does not exist yet: `maybeSingle` rather than `single`,
 * because an account that has never opened Settings simply has no row, and
 * PGRST116 is not an error worth showing anyone.
 */
export async function getUserConfig(supabase) {
  const user = await getUserOrNull(supabase)
  if (!user) return null
  const result = await supabase
    .from('user_configs')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  return unwrap(result, 'getUserConfig') ?? null
}

/**
 * The career-radar keyword list, with the user id the caller needs to write it
 * back. Selects `radar_keywords` alone — the Keywords tab has no business
 * holding `github_token` in component state to render a list of chips.
 *
 * Returns null when signed out, for the same reason as `getUserConfig`.
 */
export async function getRadarKeywords(supabase) {
  const user = await getUserOrNull(supabase)
  if (!user) return null
  const result = await supabase
    .from('user_configs')
    .select('radar_keywords')
    .eq('user_id', user.id)
    .maybeSingle()
  const row = unwrap(result, 'getRadarKeywords')
  return { userId: user.id, keywords: row?.radar_keywords ?? [] }
}

export async function updateRadarKeywords(supabase, userId, keywords) {
  const result = await supabase
    .from('user_configs')
    .update({ radar_keywords: keywords })
    .eq('user_id', userId)
  return unwrap(result, 'updateRadarKeywords')
}

/**
 * `requireUser`, not `getUserOrNull` — this is a write the user just asked for
 * by clicking Save. There is no sensible "quietly do nothing" outcome: the old
 * inline code read `user.id` with no guard, so a lapsed session threw a
 * TypeError about reading 'id' of undefined from a line that has nothing to do
 * with auth. NotSignedInError says the true thing instead.
 *
 * Upsert rather than update, because a user who has never saved a preference has
 * no row for an update to match — and an update that matches nothing succeeds,
 * which is exactly the shape of failure this whole refactor is about.
 */
export async function setTwitterAuthToken(supabase, token) {
  const user = await requireUser(supabase)
  const result = await supabase
    .from('user_configs')
    .upsert({ user_id: user.id, twitter_auth_token: token || null }, { onConflict: 'user_id' })
  return unwrap(result, 'setTwitterAuthToken')
}

// Everything account-scoped clears together. Exported as data so the optimistic
// local state update and the write cannot drift apart: leaving repo_name behind
// is what causes the split-brain on the next link.
export const DISCONNECTED_GITHUB_FIELDS = (defaultRepoName) => ({
  github_token: null,
  github_user: null,
  repo_name: defaultRepoName,
  auto_backup: false,
  last_backup_sha: null,
  last_backup_summary: null,
  last_backup_at: null,
  last_error: null,
})

export async function disconnectGitHub(supabase, userId, defaultRepoName) {
  const result = await supabase
    .from('user_configs')
    .update(DISCONNECTED_GITHUB_FIELDS(defaultRepoName))
    .eq('user_id', userId)
  return unwrap(result, 'disconnectGitHub')
}

export async function clearBackupError(supabase, userId) {
  const result = await supabase
    .from('user_configs')
    .update({ last_error: null })
    .eq('user_id', userId)
  return unwrap(result, 'clearBackupError')
}

// Only the four settings the backup form actually owns. Spreading the whole
// config into an update here would write back stale copies of every unrelated
// column the form never touched, including the token.
export async function updateBackupSettings(supabase, userId, { repo_name, repo_branch, is_private, auto_backup }) {
  const result = await supabase
    .from('user_configs')
    .update({
      repo_name,
      repo_branch: repo_branch || 'main',
      is_private,
      auto_backup,
    })
    .eq('user_id', userId)
  return unwrap(result, 'updateBackupSettings')
}

// Not user_configs, but the other settings-owned read: the recent results of the
// mobile capture endpoint, shown on Settings -> Mobile. It lives here rather than
// in a module of its own because it is a single query with one caller, and
// captureTokens.js — its nearest relative — is another surface's file.
export async function listCaptureLog(supabase, limit = 8) {
  const result = await supabase
    .from('capture_log')
    .select('id, url, ok, message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return unwrapList(result, 'listCaptureLog')
}
