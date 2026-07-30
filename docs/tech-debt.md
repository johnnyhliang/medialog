# Tech Debt & Bug Log

Known problems, ranked by what would actually hurt. Distinct from `IDEAS.md`
(future features) and `CHANGELOG.md` (what shipped) — this is the list of things
already wrong.

Nothing here is blocking today's single-user operation. Most items are labelled
"fine for one user, not fine when it isn't," which is precisely why they need to
be written down before that changes.

---

## Bugs / verification gaps

### ⚠️ TOP PRIORITY — Deno `npm:` resolution in `enrich` is unverified
`supabase/functions/enrich/index.ts` imports `npm:@mozilla/readability@0.6.0` and
`npm:linkedom@0.18.13`. These have **never resolved at runtime** — `deno` isn't
installed locally, so the specifiers are typed-correct but untested.

Mitigated, not assumed: both imports are lazy and wrapped in try/catch, so a
resolution failure logs and falls back to the old regex heuristic rather than
breaking capture. The failure mode is therefore "silently worse extraction," which
is the dangerous kind — it won't page you, it'll just quietly stop preserving
articles well.

**Deployed 2026-07-29, still unverified.** An unauthenticated probe returns a clean
JSON 401, which confirms the function boots and its auth gate works — but proves
nothing about the imports, because they resolve *lazily inside the handler*, after
the auth check returns. Verification requires one authenticated capture.

**The check:** capture any article in the app, then

```sql
select url, full_text_extractor, full_text_status, length(full_text)
from entries where full_text_at > now() - interval '10 minutes';
```

`full_text_extractor = 'readability'` means it works. `'heuristic'` means the
`npm:` specifiers failed to resolve and it silently fell back — which is the whole
reason this is top priority: nothing errors, the quality just quietly drops.

### ~~Migrations written but never applied~~ — RESOLVED 2026-07-29
All migrations through `0063` applied via `supabase db push`; `enrich` and `capture`
both deployed. Note `0059` is permanently unused — parallel worktrees claimed numbers
out of order. Current state always lives in `PROJECT-STATE.md` §1.

---

## High

### v1 MCP server has ungated bulk-write tools
`mcp-server/src/tools.js` exposes 14 tools including `create_entry`, `move_entry`,
`bulk_move_entries` and `bulk_create_entries` — built before the safety model in
`docs/superpowers/specs/2026-06-25-ai-agent-rag-design.md` existed. That spec
classifies `bulk_reassign` as **propose-only, human-confirm**, and requires an
`agent_actions` log for undo. Neither exists here: the tools mutate directly, with
no proposal step and no audit trail.

Currently dormant — it's a local stdio server that needs `SUPABASE_SERVICE_ROLE_KEY`
in env, so nothing reaches it unless you wire it into a client. But it is a loaded
gun sitting in the repo: connecting it to Claude Desktop today would hand an agent
unlogged bulk mutation over the whole library, using a key that bypasses RLS.

**Before reconnecting it to anything:** either re-gate the bulk tools behind the
propose/confirm model, or strip them to read-only. Don't rely on remembering.

### `VITE_CAPTURE_SECRET` — fix shipped, ONE MANUAL STEP LEFT
Per-user capture tokens shipped 2026-07-29: `capture_tokens` (`0063`, applied),
`src/lib/db/captureTokens.js`, Settings → **Capture tokens**, and `capture` deployed
+ verified. Tokens are SHA-256 hashed; plaintext is shown exactly once.

**The legacy path is still accepted while `CAPTURE_SECRET` is set**, deliberately, so
existing bookmarklets keep working. So the hole is still open:

> **Action:** mint tokens for each device (Settings → Capture tokens), re-copy the
> bookmarklet / Shortcut body, then **unset `VITE_CAPTURE_SECRET` in the build env
> AND `CAPTURE_SECRET` in Supabase secrets.** That is what actually closes it. The
> Settings tab warns while the legacy secret is present.

Original problem, for the record:
`SettingsView.jsx` renders bookmarklet / iOS Shortcut templates containing the
capture secret. Any `VITE_`-prefixed var is inlined at build time, so the secret
ships to every visitor who loads the JS.

Acceptable under a single-user threat model — it's your own secret protecting your
own capture endpoint. **Not acceptable the moment signups exist**, because every
user would receive the same shared secret and could post to
`capture` as `CAPTURE_USER_ID`. Fix before any public launch: per-user capture
tokens minted server-side, fetched at runtime, never inlined.

### Instagram session scraping is fragile and ToS-gray
`fetch-reels` depends on a session cookie in `user_configs.twitter_auth_token`.
It will break without warning and can't be defended if challenged. Already listed
under *Cuts / quiet retirements* in `IDEAS.md` — park unless used weekly.

### `App.jsx` is a god object — 1332 lines, 55 handlers, 26 `view ===` branches
The hook extraction (`useTopics`, `useEntries`, `useInbox`, …) moved *state* out
but left *orchestration* in. Share-target handling, imports, OAuth callback,
revisit, trash, export, entitlement loading and now event tracking all live in one
component.

Concrete evidence this is costing real time: three parallel branches all edited
`App.jsx` in the same session. They merged cleanly by luck, not design.

Next cut should follow seams that already exist rather than splitting by line
count — `useShareTarget`, `useOAuthCallback`, and a routing module that owns the
`view ===` ladder (26 branches) are the obvious three.

---

## Medium

### `styles.css` monolith — 5422 lines / 153 KB
The entire design system in one file, and every feature keeps appending to it
(this session added three separate blocks). Split by surface — tokens, layout,
then per-view — before it becomes unnavigable. No framework needed; the CSS
itself is fine, it's the packaging that isn't.

### ~~Dead landing backups~~ — RESOLVED 2026-07-29
`LandingPage.backup.jsx`, `landing.backup.css` and the orphaned `src/lib/fetchFeed.js`
deleted; all had zero references including the HTML entry points. Note
`src/lib/retrievalEval.js` was checked and **kept** — it is a deliberate
before/after harness for `chunkConfig` tuning, not forgotten code.

### ~~`allorigins.win` SPOF~~ — RESOLVED 2026-07-30
Zero references remain in runtime code. Feeds moved server-side earlier
(`fetch-feeds`), the orphaned `src/lib/fetchFeed.js` was deleted, and
`crawlArchive` now calls the new `crawl-archive` edge function.

Parsing there is regex-based rather than DOM-based (Deno has no `DOMParser`),
reusing the approach already proven in `fetch-feeds`. Verified against live sites
before deploying: danluu 128/128 atom entries, simonwillison 30/30, jvns 20/20,
and 16,808 URLs off simonwillison's sitemap. That last number prompted a
`MAX_ITEMS = 500` cap — the uncapped response was multi-megabyte JSON that would
also have overwhelmed the picker UI. The old client-side version had the same
unbounded behaviour.

The function requires a logged-in user; without that gate it would be an open URL
fetcher anyone could point at arbitrary hosts using our egress. `isSafeUrl` is
re-checked per fetched URL, not just on user input, because sitemap indexes point
at child sitemaps a hostile site could aim at internal addresses.

### Feature sprawl — many near-products in one shell
Reels, career/opportunities, interview bank, deep topics, digest, boards. The
modules system (migration 0057) makes this *manageable* by letting each be turned
off, but it doesn't reduce the maintenance surface. Retiring things is still the
only real fix.

### Regex HTML sanitization on public share
`public-share` sanitizes with regex, which is not a sanitizer. Low risk while you
are the only author of your notes; a real problem the moment shared content is
user-generated by anyone else. Use a parser-based sanitizer before that.

---

## Lower

### ~~`showFounderUploads` outside the module system~~ — RESOLVED 2026-07-30
Now the `uploads` module (`minTier: 'founder'`), resolved via the new
`src/hooks/useModuleAccess.js` — `NoteEditor` has two callers, so a local hook
beat threading entitlement through both. `src/lib/account.js` is down to `isDev`
and `isFounder` (the latter only as the tier source for migration `0057`).

**Behaviour change worth knowing:** uploads is `defaultOn: false`, so it is now
opt-in per account rather than automatically on in dev. The grandfathered founder
account has it; a fresh account must enable it in Settings → Modules. The old test
encoded the previous always-on-in-dev behaviour and was rewritten to cover both
directions.

### ~~Duplicated `isSafeUrl`~~ — RESOLVED 2026-07-30
`capture/index.ts` now imports from `_shared/isSafeUrl.ts`; the inline copy was
byte-identical and is gone. `crawl-archive` uses the same shared module.

### Silent fire-and-forget chunk indexing
`chunkEntryAsync` deliberately never throws — indexing must not break a save,
which is right. But there's no signal anywhere when indexing fails, so semantic
search can quietly go stale with no indication. The `full_text_status` marker
(0060) is the pattern to copy: a per-entry index status would make staleness
visible. Related: the import queue (task #5) needs somewhere to report failures.

### `EntryCard.jsx` (~650 lines) does too many jobs
Display, inline edit, tagging, versioning, preview, archive. Split along the
same lines as the props it takes.

---

## Bottom line

The core is genuinely good: search that isn't naively embedding-only, backup that
respects GitHub limits and secret boundaries, capture that works on iOS/Android,
sharing that doesn't punch holes in RLS. Real constraints, closed loops.

The cost is **concentration** — too much product surface and too much UI/CSS
weight in too few files — plus two personal-app security tradeoffs
(`CAPTURE_SECRET` in the bundle, IG cookies) that must be revisited before this
stops being "just me."
