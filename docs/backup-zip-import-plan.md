# Zip-based backup export/import — Implementation Plan

Status: ✅ **BUILT 2026-08-0x** (`c5a1ea1`) — corrected 2026-08-06.
`src/lib/db/zipBackup.js` ships, with **Download zip** and **Import from zip** in
the UI. **The tab moved:** this plan says Settings → GitHub, but `3594169` folded
import/export/migration into a single **Settings → Data & Backup** tab
(`GitHubTab.jsx` → `DataBackupTab.jsx`), which is where the buttons actually live.

Goal, as written: let a user download a full-fidelity local backup of their
MediaLog data and restore it later — same account, a fresh account after deletion,
or after moving off GitHub sync entirely, without requiring GitHub to be connected.

---

## Why this is mostly wiring, not new logic

A full-fidelity restore path already exists: `applySnapshot()`
(`src/lib/db/githubBackup.js:39-63`), fed today only by a GitHub repo commit via
`supabase.functions.invoke('github-backup', ...)`. It already:

- iterates `SYNC_TABLES` in FK-safe order,
- re-stamps every row's `user_id` to whoever is currently signed in (so restoring
  into a *different* account already works — no special-casing needed for
  "new profile" vs "same profile"),
- upserts by `id` (or the natural/composite key in `CONFLICT_TARGETS` for
  `entry_tags`, `programs`, `companies`, `opportunity_state`, `shared_items`) —
  confirmed overwrite-on-conflict is the desired behavior for zip import too.

The separate markdown zip export (`exportMarkdown.js` / `buildZip.js`) is
presentation-only, has no IDs, and is explicitly not meant to round-trip
(comment in `githubSync.js`). It is **not** the basis for this feature and is
untouched by this plan.

---

## Scope confirmed with user

- **UI location:** Settings → GitHub tab, as a new section alongside the existing
  GitHub restore flow (not a standalone page).
- **Conflict policy:** overwrite/upsert, identical to `applySnapshot`'s current
  behavior. No new merge logic.
- **Export source:** reuse `buildFiles()` / `collectSnapshot()` as-is. Zip export
  is "the same files `githubSync.js` already produces, written to a local zip
  instead of (or in addition to) committed to a GitHub repo" — one canonical
  full-fidelity format, no parallel export pipeline.
- **`shared_items` on import:** restored to the DB but held **inactive** —
  old public share slugs do not go live automatically. User re-enables sharing
  per item after import. Needs a status/flag on `shared_items` if one doesn't
  already exist (check migration 0055) and `applySnapshot` needs to force that
  flag off on write when the source is a zip import specifically (GitHub
  restore keeps today's behavior unless we decide to unify — flag for
  discussion at implementation time).
- **GitHub dependency:** none. Zip export/import works for any signed-in user
  regardless of GitHub connection state — it's grouped in the same tab for UI
  convenience, not gated behind it.

---

## Gaps beyond entries that this plan also closes

| Data | Table | Today | This plan |
|---|---|---|---|
| Theme (palette/style) | `user_configs.theme` | not exported (whole table excluded for the token) | export via new field-level allowlist |
| Module visibility toggles | `user_configs.modules` | not exported | export via same allowlist |
| GitHub token, repo config | `user_configs.github_token/repo_name/auto_backup` | correctly excluded | stays excluded |

Everything else — deep topics (`resource_sections`), feed **sources** (`feeds`,
not `feed_items`), job tracking (`opportunities`/`applications`/
`opportunity_state`/`programs`/`companies`), assistant chat history, highlights,
entry version history, menu items/quick links — is **already** in `SYNC_TABLES`
and needs no new export logic, only the zip entry point below.

Explicitly still out of scope: attachment/snapshot binary bytes (no export path
carries file bytes today), entitlements/billing/tier (server-owned), secrets.

---

## Work items

1. **`user_configs` field-level export** (`githubSync.js`)
   Add `data/user_configs.json` as a special case outside the whole-row
   `SYNC_TABLES` loop: export only `{ theme, modules }`, never `github_token`,
   `repo_name`, `auto_backup`, `last_backup_at`, `last_error`. Import writes
   those two fields via upsert on `user_id`, leaving GitHub config columns
   untouched if the row already exists.

2. **`shared_items` inactive-on-import**
   Confirm/add a status column; `applySnapshot` (or a zip-import-specific
   variant) sets it inactive when restoring from a zip.

3. **Zip export** — new function, e.g. `buildBackupZip(snapshot)` in
   `src/lib/db/githubBackup.js` or a new `src/lib/db/zipBackup.js`:
   `collectSnapshot()` → `buildFiles()` (now including `user_configs.json`) →
   JSZip → browser download. Reuses `buildFiles`'s existing `data/*.json` +
   `manifest.json` + `README.md` + `notes/*.md` layout exactly.

4. **Zip import** — file input → JSZip unzip into `[{path, content}]` → existing
   `parseFiles()` → existing `applySnapshot()`, with the shared_items inactive
   override from (2).

5. **UI** (`GitHubTab.jsx`): new section in the same tab, "Local backup":
   download button (calls work item 3) and file-upload + preview/confirm
   restore (mirrors `handlePreviewRestore`/`handleConfirmRestore` pattern
   already used for GitHub restore, calling work item 4 instead).

6. **Docs**: update `data/README.md` generation (`renderReadme`) to mention
   `user_configs.json` and its scope (theme/modules only) so a human opening
   an old zip years later understands what's there.

---

## Open question for implementation time

Does GitHub-repo restore also get the `shared_items`-inactive treatment, or
does it keep today's live-restore behavior and only zip import differs? Two
restore paths behaving differently for the same table is worth resolving
before writing `applySnapshot` changes, not after.
