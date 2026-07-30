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

### ~~`VITE_CAPTURE_SECRET` in the client bundle~~ — RESOLVED 2026-07-30
Fully closed and verified. Per-user capture tokens (`0063`) shipped, then:
`CAPTURE_SECRET` unset from Supabase secrets, `VITE_CAPTURE_SECRET` deleted from
Vercel production, and the site rebuilt. Confirmed by fetching the live bundle and
searching for the literal value — absent from the new `SettingsView` chunk.

**Two findings from doing it, worth keeping:**

1. **It was never exploitable.** `CAPTURE_USER_ID` had never been set as a Supabase
   secret, so the legacy path had no account to attribute captures to — a probe with
   the real secret returned 401. The exposed secret was a latent hole, not an open
   door, and the bookmarklet had been silently broken for some time. Earlier notes
   here claiming an attacker could write to the Inbox were wrong.
2. **Removing an env var is not enough.** `VITE_`-prefixed values are inlined at
   build time, so the deployed bundle keeps the secret until a rebuild replaces it.
   Deleting the variable and *not* redeploying looks fixed and isn't.

Original problem, for the record: `SettingsView.jsx` rendered bookmarklet / iOS
Shortcut templates containing the shared capture secret, which shipped to every
visitor who loaded that chunk.

### Bookmarklet tokens are plaintext by construction — accepted risk
A bookmarklet is a string in your bookmarks with no secure storage, so whatever
credential it carries is necessarily visible in that string. Per-user tokens
(`0063`) fixed the part that was fixable — the credential is no longer shipped to
every visitor in the JS bundle, and it is now revocable per device — but the token
itself is still plaintext in the bookmark.

Residual risk: a bookmarklet runs **in the page's context**, so a hostile site
could monkeypatch `fetch` and capture the token when you click. Low likelihood,
but it is the security ceiling of the mechanism, not an implementation gap.
Mitigation is revocation (Settings → Capture tokens), which is now instant.

**The real fix is the browser extension** in `docs/preservation-v2-spec.md` §1:
extension code runs in an isolated world the page cannot reach, so the token is
never exposed to visited sites. That spec wanted an extension for login-walled
capture; it resolves the credential problem as a side effect. Until then, treat a
bookmarklet token as something to revoke on suspicion rather than protect
perfectly.

### Captured entries are never enriched — and wiring it up naively is worse
Found 2026-07-30. `capture/index.ts` never calls `enrich`, and `enrichEntries` in
`App.jsx` runs only on client-side creation paths (QuickAdd, bulk import,
migration). Entries created server-side by the bookmarklet / iOS Shortcut are
therefore **never enriched at all** — they keep the URL and `document.title` and
nothing else, and `full_text_status` stays null permanently.

This is most of why `check-preservation` reports 955 entries / 0 preserved / 955
"not attempted".

**Do not just wire `enrich` into `capture`.** It runs server-side and logged out,
so for any login-walled or paywalled page it fetches the wall, not the article.
`MIN_ARTICLE_CHARS` (500) catches short stubs, but a wall with nav, footer and
"subscribe to continue" boilerplate clears 500 easily — Readability would extract
it and store it as `full_text_status = 'ok'`. That is worse than storing nothing:
junk feeds the embeddings, pollutes semantic search, and the coverage number lies.

Options, in order of correctness:
1. **Browser extension** (`docs/preservation-v2-spec.md` §1) — serializes the DOM
   in your authenticated session, so it captures what you actually saw. The only
   mechanism that works for login-walled content at all.
2. Enrich captured entries but **only for public pages**, with a paywall/login
   heuristic that marks suspected walls `empty` rather than `ok`.
3. Leave as-is. Captures stay bookmarks-with-titles; the backfill script handles
   preservation for public URLs on demand.

Today's behaviour is accidentally the safe one, which is why this is logged rather
than hot-fixed.

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
