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

**Update 2026-07-30 — the extraction logic is verified; only the Deno runtime path
is not.** Run against live pages through the exact production code path
(`makeReadabilityParser` + `extractArticle`, real Readability + linkedom):

```
readability   60000 chars   paulgraham.com/greatwork.html
heuristic      8764 chars   danluu.com                  <- correct: a link index
none              0 chars   danluu.com/productivity/    <- correct: a 404
```

**Use prose articles to verify.** A first attempt read a single heuristic capture
of danluu.com as proof the deploy was broken, and it was nothing of the kind —
Readability is *supposed* to decline a link index. `scripts/check-preservation.js`
now reports INCONCLUSIVE for that case instead of FALLING BACK (`a7430b7`), but the
underlying lesson stands: **one sample of a non-article can never be evidence
either way.** Capture 2–3 blog posts or news pieces, then run the script.

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

### Contextual retrieval was never applied — ROOT CAUSE FOUND, re-index pending
Found and diagnosed 2026-07-30. **5 of 4,976 chunks have a `context` value.**
All 5 are `full_text`; **0 of 4,971 `note` chunks** have any, despite 361 entries
producing the 2+ chunks that qualify.

**Root cause:** `scripts/rechunk.js` reads `AI_BASE_URL` / `AI_API_KEY` /
`AI_MODEL` from `process.env`. Those live as **Supabase secrets**, not in
`.env.local`, so `canContextualize` was always `false` and every chunk the script
wrote got `''`. The 5 that DO have context came through the app instead, where
`contextualizeChunks` calls the `ai` edge function, which has the secrets.

**It even warned** — line 57 printed "indexing WITHOUT contextual retrieval (lower
quality)" — and that warning scrolled past. Chunks written without context are
*indistinguishable* from good ones: same shape, same dimensions, no error, working
search. Nothing could surface the difference except inspecting the DB.

**Fixed 2026-07-30:** the script now reads `.env.local` (real env still wins), and
**refuses to run** without the AI vars unless given an explicit `--no-context`.
Degrading is now a choice someone makes, not an accident they scroll past.

**Still to do — this is the actual repair:**
1. Add `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` to `.env.local`
2. **Build a real eval fixture first.** `tests/src/lib/retrievalEval.fixture.json`
   is still the shipped template — 2 placeholder queries and a note saying
   "replace expected[] with real entry ids". Without a baseline there is no way to
   answer "did contextual retrieval help", which is the whole question.
3. `runEval` → record the number
4. `node scripts/rechunk.js` → regenerates ~4,971 chunks WITH context
5. `runEval` again → compare

Step 2 before step 4, or the opportunity to measure is gone. The cited benefit is
~35% fewer retrieval failures (~49% with a lexical arm); whether that holds on a
personal notes corpus is exactly what the harness exists to find out.

**Cost note (updated 2026-07-30):** step 4 re-embeds ~5k chunks and runs the
contextualizer over ~360 documents. At the old batch size of 8 that was 798
contextualizer calls and ~$5.34; **at the new size of 32 it is 397 calls and
~$2.70.** Rate-limited by the Gemini key pool (5 keys) and the free-tier AI
provider, so expect it to take a while — resumable via `source_hash`.

**Do the batch-size change before the re-index, not after.** It is already
committed (`ca0e8d0`), so a re-index run today gets the cheaper path for free —
but a re-index run from an older checkout would pay double and produce chunks
shaped by a config you are no longer using.

### `index_status = 'pending'` is declared everywhere and written nowhere
Found 2026-07-30 while tracing the indexing paths end to end.

`0068` defines `pending`. `IndexStatus`'s `STATES` map renders it ("Indexing…").
`listUnindexed` selects on `index_status in ('pending','failed')`. But
`chunkEntryAsync` only ever calls `markIndex` with `ok`, `empty` or `failed` —
**nothing ever writes `pending`.**

**Consequence:** indexing runs entirely in the browser, so closing a tab mid-import
abandons the work. Those entries keep `index_status = null` (`not_attempted`),
which `listUnindexed` does **not** select. The notes are unsearchable *and*
invisible to the retry banner — the exact silent-unfindability failure that `0068`
was written to eliminate, surviving in the one case where the work never finishes.

**Fix:** write `pending` before the first source is processed. ~5 lines, no schema
change, and worth doing before the queue exists rather than waiting for it.

### Bulk import fires unbounded parallel indexing
`src/App.jsx:798` (and 776, 838, 872):

```js
created.forEach(e => chunkEntryAsync(supabase, e))
```

No `await`, no concurrency limit. Importing 500 notes starts 500 indexing pipelines
simultaneously — 500 contextualizer calls and 500 embed calls racing. Nothing paces
them, nothing bounds them, and the work exists **only in browser memory**, so
whatever hasn't run when the tab closes is simply lost.

This is the concrete failure the jobs table (task #5) fixes. It is not a
theoretical nicety, and it is also why there is currently no graceful way to
handle running out of AI quota mid-import: deferred work needs somewhere to wait,
and right now there is nowhere. `reindexBatch` already demonstrates the right
shape — it paces retries at 3/second precisely so a retry can't recreate the burst
that caused the failures — but the import path doesn't use it.

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
