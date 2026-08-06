# MediaLog — Project State

**Updated 2026-08-06 (UX bugs + backup coverage)** from the filesystem and git, not
from memory. **Overwritten on each regeneration, never appended** — an append-only
log is always partly wrong; a snapshot is always current.

Companions: `CHANGELOG.md` (what shipped + why) · `docs/README.md` (which docs to
trust) · `docs/tech-debt.md` (severity-ranked problems) ·
`docs/indexing-architecture.md` (how search indexing works + what it costs) ·
`PRODUCTION.md` (cost model, scaling, closed-source list) · `IDEAS.md` (proposals).

**Hard numbers (recounted 2026-08-06):** 69 migrations (`0071` is the highest;
`0059` was never used) · 17 edge functions · 72 components · 73 lib modules ·
116 test files / **731 tests passing** · 100 docs · `App.jsx` 1320 lines ·
`styles.css` 5784 lines.

## → Start here: [§6 Ranked next actions](#6-ranked-next-actions-the-single-backlog)

That table is **the one list** — bugs, features and north-star work ranked together,
each row pointing at the file that owns the detail. Read it before anything else in
this document.

**Git in the situations this repo gets into → [`docs/git-learning.md`](docs/git-learning.md).**
Written from the real tangle on 2026-07-30 (two sessions in one working tree, a
stray `main` branch, a rebase blocked by an untracked `CLAUDE.md`). Covers reading
ahead/behind, why `git add -A` is dangerous here, what to do when a rebase stops,
and the escape hatches. The codebase was never broken — 696 tests and the build
passed throughout, and everything is on `origin/master`.

**Raw notes moved out 2026-07-31.** A block of untriaged observations sat above the
first heading here — unsafe, because this file is *overwritten* on each regeneration
and would have silently deleted them. They now live where they belong: eight
reported UX problems in [`docs/tech-debt.md`](docs/tech-debt.md) (§ *Reported UX
problems — untriaged*), and the Deep-Topics-collapse + topic-aware-feed proposal in
[`IDEAS.md`](IDEAS.md) (§ *Big swings*). Nothing was discarded. **Put new
observations in those two files, not in this one.**

---

## 0a. Session synthesis — 2026-08-02 → 08-06 (UX bugs + backup coverage)

**Shipped:** four of eight reported UX bugs · backup coverage for seven tables that
were never carried · a local zip backup and a Data & Backup settings tab (parallel
session) · Progress topic picker (parallel session).

Decisions and findings worth keeping:

- **"No save button" was not a missing button.** Programs already saved on change;
  three career tabs updated state optimistically and never checked the write's
  error, so a rejected update rendered as saved until a reload reverted it. Adding
  the requested button would have shipped a second way to trigger the same unchecked
  write. **Read a UX report as a symptom, not a diagnosis.**
- **Rolling back to a remembered value is not a valid revert.** A date field fires a
  change per keystroke, so each call captures the previous *optimistic* value and
  undoes only the last keystroke. Re-reading from the server is the only thing that
  reliably makes the UI match the database. The first fix was wrong; a test caught it.
- **A backup that omits an FK parent is not a backup.** `opportunity_state`
  references `opportunities` NOT NULL, which was not synced — a restore into an
  empty database failed outright, in exactly the disaster-recovery case backups
  exist for. Table *ordering* in `SYNC_TABLES` is now test-asserted: `applySnapshot`
  walks it front to back, so order is correctness.
- **Tests that never remount cannot catch a persistence bug.** `useArchiveToast`
  shipped with no write at all; its test asserted the setter updates the value,
  which passes either way. The setting worked until you reloaded, and nothing in
  the suite ever reloaded.
- **Code written but never called is indistinguishable from code that doesn't
  exist.** `renderReadme` had been complete for months and was never wired in, so
  backup repos shipped with no explanation of themselves. Found by lint, not by a
  test. Nearly documented behaviour that didn't happen.
- **The parallel-session hazard is live, not historical.** Three commits landed on
  top of this session's work from a window in the *same directory*. Nothing
  collided, but a `git add -A` here could have swept in-progress files. Stage
  explicitly.

**Still only you can do it:** Supabase automatic backups are off on the free tier
and no application-level backup substitutes for them. §6 row 0.

---

## 0b. Session synthesis — 2026-07-30 (evening)

**Shipped:** operator audit log (`0069`), activation metrics, per-account probe,
contextualisation batch 8 → 32 with a split-and-retry guard, settings-tab drift
test, assistant keybind made remappable.

Decisions worth keeping:

- **Chat and indexing must NOT share a quota.** A shared budget means importing
  your library exhausts your ability to ask questions about it — the app punishing
  you for using its core feature, at the moment you're deciding whether you like
  it. Chat gets a visible rolling window and a hard cap; indexing is cost-of-goods
  with no user-facing cap, queued and drained.
- **Contextualisation cost tracks CALLS, not chunks**, because the whole document
  is re-sent every call. Measured on the real corpus (4,976 chunks / 396 docs,
  median 8 chunks/doc, p90 31): batch 8 = 798 calls, batch 32 = 397, batch 50 =
  369. Chose 32 — covers 90% of documents in one call, then the curve flattens.
- **A short contextualizer answer must never be padded with `''`.** A
  context-free chunk is indistinguishable from a good one, which is exactly how
  4,971 chunks were written empty unnoticed. Split and retry instead; that guard
  is what makes a large batch safe.
- **Reversible controls need an audit trail.** Emergency stop and per-account
  pause were booleans with no record of why. Weeks later that leaves a flag and no
  memory, so "leave it paused" starts to feel safe — wrong for a paying user.
  `admin_actions` records before/after, so undo never needs recall.
- **Founders excluded from activation and cost stats.** The operator activates by
  construction; one row swings a small-N rate by double digits.
- **Backfilling `full_text` for old entries is NOT worth doing.** Measured: 948 of
  956 unpreserved URL entries are bare bookmarks — github (248), YouTube (185),
  reddit (88), leetcode (57). Readability has nothing to extract, and indexing
  README boilerplate makes search worse. Any future backfill must filter to
  entries that have a note or takeaway.
- **The operator probe reports counts and statuses only** — never note text,
  titles, URLs or search queries. Being the operator is not a licence to read
  someone's library.

Corrections from this session: the preservation checker's **"FALLING BACK"
verdict was wrong** — it concluded a broken Deno deploy from one capture of
danluu.com, which is a link index Readability is *supposed* to decline. Verified
against live pages: Paul Graham → `readability` 60k chars, danluu.com →
`heuristic` (correct), danluu.com/productivity/ → 404. **The extractor works.**

---

## 0. Session synthesis — 2026-07-30 (earlier)

Decisions made here that aren't recoverable from the diff:

- **Metering ships before caps.** A limit guessed before `ai_usage` has history is
  either useless or hostile. `aiCallsPerWindow` is `null` on purpose.
- **`embed-entry` is the cost centre, not chat** (measured). It fires on every
  entry save for every user. Capping chat alone would look responsible and change
  almost nothing.
- **Rolling 5h window, not monthly.** A monthly cap answers "you're out" with a
  date weeks away; a rolling window always supports "wait a bit".
- **Entry count is never limited.** Capping capture poisons the core loop.
- **Per-account AI pause does not block embeddings** — that fails silently and
  makes notes unsearchable with no signal. Only the global switch blocks them.
- **`stage` gates maturity separately from `minTier`.** Experimental/beta are
  founder-only automatically, so a half-built feature can't ship by someone
  forgetting to also edit the tier.
- **App-help is not RAG.** The corpus is ~1k tokens; retrieval exists for corpora
  that don't fit. Derived from the registry so it can't drift.
- **`career` moved founder → free**; it scrapes public boards on a shared cron.
  `interview` stays founder-only: personal curriculum, not product.
- **Reels parked, not deleted.** Kept reachable to a founder.

Corrections worth remembering: the exposed `VITE_CAPTURE_SECRET` was never
actually exploitable (`CAPTURE_USER_ID` was never set, so the legacy path 401'd);
`retrievalEval.js` is a deliberate tuning harness, not dead code.

---

## 1. Deployment truth — what is actually live

| Layer | State |
|---|---|
| `master` | **in sync with `origin/master`** — 0 ahead, 0 behind (verified 2026-08-06) |
| Frontend | auto-deploys on push |
| Migrations | **`0071` is the highest** (`0071_shared_items_active.sql`). ⚠️ **Written, not confirmed applied** — `0070`/`0071` landed from a parallel session; verify with `supabase db push` before trusting |
| Edge functions | **17** |
| `capture` auth | **verified live**: rejects bogus/absent/wrong credentials |
| `0059` | permanently skipped (parallel worktrees claimed numbers out of order) |
| Tests / build | **731 passing, build clean** (verified 2026-08-06) |

**Those commits are pushed.** A parallel session created a remote `main` branch and
merged it to `master` via PR #5; local `master` sits on top of `main`'s history.
Decided: **`master` stays trunk, `main` was a one-off.**

**Careful with `git add -A` in this repo.** A parallel window works in the *same
directory*; a blanket add swept 6 of its in-progress files into a commit
(recovered by soft reset). Stage explicitly.

**Verified live this session:** `admin_actions` RLS holds with data present —
anon `select` returns 0 rows, `insert` → `42501`, `log_admin_action` RPC →
`42501`. Anon hits on `audit`/`activation`/`account` actions all 401.

**No migration or function gaps remain.** `scripts/set-tier.js` now works, so paid
surfaces are testable: `node scripts/set-tier.js <email> paid`.

**Capture secret fully removed 2026-07-30.** `CAPTURE_SECRET` unset from Supabase,
`VITE_CAPTURE_SECRET` deleted from Vercel, site rebuilt, and absence verified by
fetching the live bundle. Two findings: it was never actually exploitable
(`CAPTURE_USER_ID` had never been set, so the legacy path 401'd — the bookmarklet
had been quietly broken), and deleting the env var alone is insufficient because
`VITE_` values are inlined at build time and persist until a rebuild.

A capture token is minted and verified end-to-end; the bookmarklet and iOS tabs now
generate token-based code. Manage or revoke at Settings → Capture tokens.

---

## 2. Mid-development — code that exists but is not reachable by a user

The largest source of "did that get built?" confusion. All of it is real, tested,
committed — and **nothing in the UI imports it**.

| Module | Lines | What's missing | Spec |
|---|---|---|---|
| `src/lib/interviewPlan.js` | 210 | Readiness rings, staleness dot, gap list, target-date + focus editor | `docs/interview-progress-spec.md` §4 step 4 |
| `src/lib/db/studyPlan.js` | 33 | Same UI as above; `prep_target_date`/`prep_focus` are never read | same |
| `src/lib/billingPlan.js` | 121 | Stripe webhook + checkout. **Inert by design** — status→tier mapping is done and tested | `docs/metering-scope.md` |
| `src/lib/goals.js` | 85 | Entire feature. Pure lib, no migration (goals = entries w/ frontmatter) | `docs/superpowers/specs/2026-07-17-goals-tracker-design.md` |
| `src/lib/preservation.js` | 48 | `preservationPatch` **is** wired; `preservationCoverage` has no UI (◆ marker, "N of M preserved") | `docs/content-preservation-plan.md` T3 |
| `scripts/backfill-full-text.js` | 224 | Never run against real data | same |

**Dead code — REMOVED 2026-07-29:** `src/lib/fetchFeed.js` (86 lines, orphaned when
feeds moved server-side in `fbdc2d7`), `src/components/LandingPage.backup.jsx`
(570), `src/landing.backup.css`. All three had zero references anywhere including
the HTML entry points.

**Correction to an earlier claim:** `src/lib/retrievalEval.js` is **not** dead. It's
a deliberate comparative harness (`failureRate`/`recallAt5`/`mrr`) for before-and-
after `chunkConfig` changes, with its own tests. **Kept.** It has no production
importer by design — it's a tool you run when tuning retrieval, like a script.

**TODO sweep:** **zero** markers repo-wide as of 2026-07-30. The single one that
existed (`account.js`, the `showFounderUploads` note) was resolved by folding
uploads into the module system.

**Metering landed 2026-07-30:** `_shared/meter.ts` · `0065_ai_usage.sql` ·
`src/lib/limits.js` · `admin-metrics` function · `MetricsView.jsx` ·
`src/lib/db/adminMetrics.js` · usage readout in Settings → Behavior.

**Autonomous fixes landed 2026-07-30** (no user action needed for any of these):
`isSafeUrl` deduplicated into `_shared` · `showFounderUploads` → the `uploads`
module via the new `src/hooks/useModuleAccess.js` · `crawlArchive` moved to the
`crawl-archive` edge function, retiring the last allorigins dependency.

---

## 3. Feature gaps, precisely

### 3.1 Monetization — skeleton only (~40%)
**Built:** `user_entitlements` (select-own, **no write policy** — tier is
unforgeable) · `free`/`paid`/`founder` · per-module `minTier` ·
locked-with-upgrade rendering · `0062` `subscriptions` +
`sync_tier_from_billing()` with the founder-never-downgraded guard ·
`src/lib/billingPlan.js` status→tier mapping (14 tests) · `scripts/set-tier.js`.

**Gaps:**
1. **No Stripe integration.** No webhook function, no product/price setup, no
   checkout session. Not spec'd anywhere.
2. **No upgrade/downgrade UX.** Locked modules show an affordance that leads
   nowhere.
3. **Nothing is actually `paid`.** `assistant` sits at `founder` deliberately —
   promoting it before metering exists would expose the shared AI key to signups.
   **So `paid` currently grants nothing `free` lacks.**
4. **No cap enforcement**, which is the same blocker from a different angle.
5. `expires_at` is read by `resolveTier` but nothing ever writes it.
6. **Testable now:** `node scripts/set-tier.js <email> paid`, or the tier dropdown
   in the founder **Metrics** view (routes through the same `set_tier_manual`).

**What tiers now actually mean** (`src/lib/limits.js`):

| Dimension | free | paid | founder |
|---|---|---|---|
| Storage | 500 MB | 10 GB | unlimited |
| Feed sources | 10 | 100 | unlimited |
| Backup interval | 24h | 1h | unlimited |
| AI calls/month | *unset pending data* | *unset* | unlimited |

Entry count is deliberately **not** limited — capping capture would poison the core
loop. Enforcement: `createFeed` throws a `LimitError` the UI can turn into an
upgrade prompt; `snapshot` returns 413 with the actual limit.

→ **You still cannot charge anyone** — no Stripe, no checkout. But tiers now grant
something real, and you can see per-user cost.

### 3.2 Analytics — 3 of 3 phases built (caps pending)
| Phase | State |
|---|---|
| Events (`0058`, `track.js`) | ✅ live, collecting |
| **AI + storage metering (`0065`)** | ✅ **built and deployed 2026-07-30** |
| Admin dashboard (`metrics`) | ✅ built — founder-only `MetricsView` |

**What metering does now:** `ai_usage` records per-user/day/function/model counts
and estimated cost. `ai` reads the provider's real `usage.prompt_tokens` /
`completion_tokens` (it was receiving and discarding them); `embed-entry` estimates
at ~4 chars/token since Gemini returns none. `_shared/meter.ts` never throws —
metering is observability, not correctness.

**Verified live:** anon → 401 on `admin-metrics` · client `INSERT` on `ai_usage` →
`42501` · 3 concurrent RPCs → 1 row with `calls = 3`.

**Still open — caps.** `TIER_LIMITS.aiCallsPerMonth` is `null` (unlimited) on
purpose: a cap guessed before real usage data would be wrong. Enforce after ~a week
of `ai_usage` history. See `docs/metering-scope.md` Step 5. **Do not cap
`embed-entry` on the request path** — that degrades search silently.

### 3.3 Preservation — 1 of 4 tiers, one tier broken, one path never runs

**Found 2026-07-30:** entries created by the capture endpoint (bookmarklet, iOS
Shortcut) are **never enriched** — `capture` doesn't call `enrich`, and
`enrichEntries` only fires on client-side creation paths. They keep URL + title
and nothing more. That is most of why coverage reads 955/0. Wiring it up naively
would be *worse* than leaving it: `enrich` runs logged out, so login-walled pages
would store the wall as if it were the article. See `docs/tech-debt.md`.
| Tier | State | Spec |
|---|---|---|
| Images/PDFs (Phase 1) | ✅ `snapshots` bucket, `snapshot` fn | `docs/content-preservation-plan.md` |
| Article text | ✅ built, ⚠️ **extractor unverified** | same, part (a) |
| Public page fidelity (Wayback) | ⚠️ **built and broken** | `docs/preservation-v2-spec.md` §2 |
| Auth'd / JS-heavy pages | ❌ browser extension | same §1 |
| Video transcripts | ❌ edge function, no worker needed | same §3 |
| Video media | ❌ R2, opt-in | same §3 |

**Blocking dependency — now unblocked.** The extension could never have shipped
`VITE_CAPTURE_SECRET` (extension bundles unpack trivially). Per-user capture tokens
(§1 of that spec) shipped 2026-07-30, so the client-capture line of work is clear
to start.

### 3.4 The intentional-app trio — 1 of 3
| Part | State | Spec |
|---|---|---|
| Modularity | ✅ built as 3 layers | `docs/intentional-app-spec.md` Part 2 |
| **Reminders + Agenda** | ❌ **highest product value** | same Part 1 |
| Today / Morning Open | ❌ depends on reminders | same Part 3 |

Reminders is the strongest remaining idea: *reminders are entries with a `due_at`,
not a new pile*, so they inherit capture, topics, tags, search, synthesis,
archival, versioning and GitHub backup for free. Unblocked now that modules exist,
so it can ship behind a toggle from day one. **Today must come after** — it is a
view *over* reminders.

### 3.5 Everything else not built → [`IDEAS.md`](IDEAS.md)

**This list was deleted 2026-08-06 rather than updated.** It had become a second
index of the first — half its entries were already cross-references (*topic synthesis
(`IDEAS.md` ①)*, *wikilinks (②)*), which means two lists to keep in sync and
therefore one that is always wrong. `ai_usage` and the admin dashboard were still
listed here as unbuilt months after they shipped, which is exactly that failure.

**`IDEAS.md` is the registry of every proposal.** The subset that is actually next is
ranked in §6 below. Nothing was lost in the deletion: the two genuinely-unbuilt
infrastructure items it named live on as §6 row 9 (the `jobs` table, which should
share one table with preservation jobs) and the deferred agent steps 3–5.

---

## 4. Known-broken — not merely unbuilt

1. ~~**Readability extractor unverified**~~ — **the extraction logic is verified,
   the Deno runtime path is not.** Run against live pages through the exact
   production code path: Paul Graham → `readability` 60,000 chars; danluu.com →
   `heuristic` (correct — it's a link index Readability declines); a 404 → `none`.
   **Still open:** whether `npm:` specifiers resolve inside Deno specifically.
   Capture **2–3 prose articles** (not GitHub/YouTube/Reddit — Readability
   correctly declines those) and run `node scripts/check-preservation.js`.
   The checker's verdict logic was fixed (`a7430b7`): one heuristic capture now
   reads INCONCLUSIVE, because it previously claimed a broken deploy from a
   single sample of a page that could never have been a Readability hit.

1b. **⚠️ `index_status = 'pending'` is never written.** The status exists in
   `0068`, in `IndexStatus`'s `STATES` map, and in `listUnindexed`'s filter — but
   `chunkEntryAsync` only ever writes `ok`, `empty`, `failed`. **Consequence:** a
   tab closed mid-import leaves entries at `null` (`not_attempted`), which
   `listUnindexed` does not select, so those notes are unsearchable **and
   invisible to the retry banner**. ~5 lines to fix (write `pending` before the
   work starts). Independently useful before the queue exists.

1c. **⚠️ Bulk import fires unbounded parallel indexing.** `App.jsx:798` is
   literally `created.forEach(e => chunkEntryAsync(supabase, e))` — no `await`, no
   concurrency limit. Importing 500 notes starts 500 pipelines at once. The work
   exists **only in browser memory**, so closing the tab loses whatever hasn't
   run. This is the concrete failure the jobs table fixes; it is not a
   theoretical nicety.

2. ~~**`VITE_CAPTURE_SECRET` in the bundle**~~ — **RESOLVED 2026-07-30.** Tokens
   shipped (`0063`), `CAPTURE_SECRET` unset, Vercel var deleted, site rebuilt, and
   absence verified against the live bundle. It turned out never to be exploitable:
   `CAPTURE_USER_ID` had never been set, so the legacy path 401'd and the
   bookmarklet had been quietly broken. An earlier note here claiming an attacker
   could write to the Inbox was wrong.

3. **Wayback records unverified successes.** `submitArchive` is a bare
   `window.open`; the caller writes `wayback_submitted_at` regardless, and the
   bulk submitter then **permanently skips** those entries. One `catch` collapses
   rate-limit / CORS / timeout / malformed into one `'error'` indistinguishable
   from "not archived" — the ambiguous UI you noticed.

4. **`mcp-server/` exposes ungated bulk writes.** `bulk_move_entries`,
   `bulk_create_entries` mutate directly with no proposal step and no
   `agent_actions` log, predating the safety model in the agent spec. Dormant
   (needs a service-role key + a wired client) but must be re-gated or stripped
   to read-only before connecting it to anything.

5. ~~**Silent index staleness**~~ — **RESOLVED** by `0068`: `index_status`,
   `indexed_at`, `index_error` per entry, surfaced by `IndexStatus` (quiet when
   healthy), `IndexHealthBanner` ("N notes aren't searchable" + a retry paced at
   3/s), and the operator probe. **But see 1b** — the `pending` state is declared
   and never written, which leaves one real hole in the coverage.

5b. **4,971 chunks have no context.** `scripts/rechunk.js` read the AI vars from
   `process.env`, where they never existed (they're Supabase secrets), so
   `canContextualize` was always false. The script warned; the warning scrolled
   past, and a context-free chunk is indistinguishable from a good one. **Script
   fixed** (`944a51b`) — it now reads `.env.local` and refuses to run without the
   AI vars unless `--no-context` is passed explicitly. **The chunks are still
   empty, deliberately:** re-indexing costs ~$2.70 at the new batch size, and
   spending it before an eval baseline exists means never learning whether
   contextual retrieval helps *this* corpus.

6. ~~**`allorigins.win` SPOF**~~ — **RESOLVED 2026-07-30.** Zero references in
   runtime code; `crawl-archive` edge function replaces it. Parser verified against
   live sites (danluu 128/128, simonwillison 30/30, jvns 20/20) and capped at 500
   items after a sitemap returned 16,808.

7. **Regex HTML sanitization in `public-share`** — not a real sanitizer. Low risk
   while you author all notes; a problem the moment shared content isn't yours.

---

## 5. Architectural concerns

**`src/App.jsx` — 1320 lines, 55 handlers, 26 `view ===` branches.** Hook
extraction moved *state* out but left *orchestration*. Evidence it is costing real
time: three parallel branches edited this file in one session and merged by luck,
not design. Seams that already exist: `useShareTarget`, `useOAuthCallback`, and a
routing module owning the view ladder. → `docs/superpowers/specs/2026-06-19-app-modularization-design.md`

**`src/styles.css` — 5784 lines / 153 KB.** The whole design system in one file,
and every feature appends (three separate blocks today). Split into tokens →
layout → per-view. No framework needed; the CSS is fine, the packaging isn't.

**`EntryCard.jsx` (704)**, **`SettingsView.jsx` (636)**, **`FeedView.jsx` (518)** —
each doing several jobs. `SettingsView` now has 13 tabs and inlines the bookmarklet
template, the Wayback bulk submitter, and the modules tab.

**~~Two competing gating mechanisms~~ — RESOLVED 2026-07-30.** `showFounderUploads`
is gone; `NoteEditor.jsx:151` resolves uploads through `useModuleAccess('uploads')`,
so the three-layer model is now the only gate. (This paragraph still claimed the old
state on 2026-07-31 while `docs/tech-debt.md` had already marked it resolved — the
same fact in two files drifted apart, which is the argument for one of them owning
it.)

**Queue duplication risk.** The import queue (task #5) and preservation jobs
(`docs/preservation-v2-spec.md` §4) are the same shape: work too slow for a
request, needing status + retries. **Build one table**, or you get two of
everything and a second thing to forget to monitor.

**Client gating is cosmetic — do not move a security boundary into it.** RLS is the
real enforcement. A forged tier in devtools reveals nav items that lead nowhere.

**Indexing orchestration runs in the browser.** `chunkEntryAsync` is called from
nine places in `App.jsx`; the client sequences chunking, contextualisation and
embedding, and the edge functions only perform the AI calls. So indexing progresses
only while a tab is open, and unfinished work is lost on close. Every other
weakness in the pipeline (1b, 1c, the missing quota pause) descends from this one
fact, and the jobs table is what moves the work server-side.

**Registry drift is now test-enforced in two places.** `SETTINGS_TABS` lives beside
`SETTINGS_INDEX` (one source of truth, tests assert every tab is searchable and
inherits its module gate), and every keybind must be a `commands.js` entry — the
assistant toggle was hardcoded in `App.jsx` and was consequently the only shortcut
that could be neither discovered nor remapped. Both are the same failure: a second
place to declare something that the first place is supposed to own.

**Hash-guard coupling.** `full_text` is a chunk source; improving extraction
invalidates `source_hash` and forces re-embedding. Any extraction change is
implicitly a re-index event, which is why the backfill throttles re-chunking inside
its loop rather than just HTTP.

**Starter-content re-embeds per signup.** "Start Here" seeds identical text for
every new account, embedded on the shared key. Fix: precompute once, copy rows
server-side on signup.

---

## 6. Ranked next actions (the single backlog)

**This table is the one list.** Bugs, features, north-star steps and infrastructure
ranked against each other, because they compete for the same hours — a backlog split
by category can't tell you what to do next. Each row names the file that owns the
detail; that file, not this table, is authoritative on *how*.

### Where each kind of thing lives

| Looking for | Read | Owns |
|---|---|---|
| **What to do next** | **this table** | the ranking |
| Bugs & things already wrong | `docs/tech-debt.md` | severity-ranked defects, incl. § *Reported UX problems* |
| Feature proposals | `IDEAS.md` | roadmap ①–④, Big swings, cuts |
| The north star | `docs/superpowers/specs/2026-07-04-north-star-experience-design.md` | four moods, Manager, `user_model`, build order ①–⑧ |
| Where it is *now* | §§1–5 above | deployment truth, gaps, known-broken, architecture |
| What already shipped | `CHANGELOG.md` | history + why |
| Which of the 100 docs to trust | `docs/README.md` | the index |
| Cost, scaling, launch checklist | `PRODUCTION.md` | incl. the **unchecked** backups box |

### Ranked

| # | Action | Kind | Why | Detail |
|---|---|---|---|---|
| 0 | **Turn on Supabase automatic backups** | ops | Free tier has **none** and pauses on inactivity. No app-level backup substitutes. Dashboard, not code — **only you can do it** | `README.md` § *Not losing your data* |
| 1 | Confirm `0070`/`0071` are applied | ops | Both landed from a parallel session; written ≠ applied | `supabase db push` |
| 2 | **Fix "everything is slow, incl. Metrics"** | bug | The one hurting daily use. *Measure first* — Metrics being slow too suggests one shared cause, not seven | `tech-debt.md` § UX #4 |
| 3 | Capture 2–3 prose articles, run `check-preservation.js` | bug | Two minutes; retires the last ⚠️ on the extractor | `tech-debt.md` |
| 4 | **Write `index_status = 'pending'`** | bug | ~5 lines; closes the mid-import blind spot (§4.1b) — notes unsearchable *and* invisible to the retry banner | `indexing-architecture.md` |
| 5 | Feed sort resets instead of sticking | bug | Small, self-contained | `tech-debt.md` § UX #7 |
| 6 | AI search runs retrieval on every prompt | bug | Needs a routing decision, not a patch. Cheaper + faster chat | `tech-debt.md` § UX #1 |
| 7 | Topic-scoped search is implicit | design | Needs design, not a fix | `tech-debt.md` § UX #6 |
| 8 | **Eval fixture** (~20 query/entry pairs) | infra | Harness exists, fixture doesn't. **Gates the re-index decision** — spend it before this and you never learn whether contextual retrieval helped | `indexing-architecture.md` §2 |
| 9 | **`jobs` table** | infra | **The keystone.** Unblocks invisible indexing, safe bulk import, meterable indexing, and the graceful quota path — deferred work needs somewhere to pause | `indexing-architecture.md` §3 |
| 10 | Two-phase indexing | infra | Rides on the queue. Makes contextualisation tier-differentiable and interruptible | `indexing-architecture.md` §4 |
| 11 | Set `aiCallsPerWindow` from real data | infra | Still `null` on purpose. Needs ~a week of `ai_usage` | `limits-runbook.md` |
| 12 | **Reminders + Agenda** | feature | **Biggest product value, unblocked.** Reminders are entries with a `due_at`, so they inherit capture/topics/search/backup free. Also the answer to "can MediaLog hold my writing tasks" | `intentional-app-spec.md` Part 1 |
| 13 | Tidy queue (north-star ①) | north star | One-card triage; queries already exist, it's a card UI | north-star spec Part 6 |
| 14 | Related-entries footer (north-star ④) | north star | pgvector exists; agent step ① as visible value | north-star spec Part 6 |
| 15 | Manager + resume cards (north-star ⑤) | north star | The genuinely missing surface | north-star spec Part 2 |
| 16 | `user_model` v1 + feed ranking (north-star ⑥) | north star | **Start logging the dismiss signal now — it's free and it's the input** | north-star spec Part 5 |
| 17 | Collapse Deep Topics into normal topics | feature | A *correction* to shipped code, not an extension. Sequence before any recommendation work | `IDEAS.md` § Big swings |
| 18 | Interview progress UI | feature | Data flows now, so rings aren't theatre | `interview-progress-spec.md` §4 |
| 19 | Wayback SPN2 rewrite | bug | Fixes a broken feature, no new infra | `preservation-v2-spec.md` §2 |
| 20 | Undo the feed floor / recommend problems | design | Open question, unsolved | `tech-debt.md` § UX #8 |
| 21 | Split `App.jsx` (1320 lines) | debt | Merge pain is already real — a parallel session edited it again this week | `2026-06-19-app-modularization-design.md` |
| 22 | Split `styles.css` (5784 lines) | debt | Every feature appends to one file | `tech-debt.md` |

**Not on this list on purpose:** anything under *Deliberately deferred* below, and
anything in `IDEAS.md` that has not earned a rank yet. A proposal is not a backlog
item until it is ranked here — that is what keeps `IDEAS.md` free to be speculative.

### The quota UX, designed but not built

Blocked on #4 — a graceful path needs a queue to pause into. Agreed shape:

- **Chat** — meter in the assistant panel from 75%; at the wall the composer
  disables with *"Out of AI calls — more capacity in 38m"* and **keeps the typed
  text**. **No automatic retries** (explicit user decision). 429 carries
  `{ limit, used, resets_at }` so the UI states facts rather than guessing.
- **Indexing** — never blocks, never errors at the user. Budget spent → the drain
  **pauses**, jobs wait in the queue, resume when capacity returns. Only visible
  artifact is the existing quiet *"N notes still indexing."*
- `UsageMeter.jsx` already implements the bar, the 90% warning and the reset
  copy — but renders only in Settings and returns `null` while limits are `null`.

**Deliberately deferred:** agent steps 3–5 and MCP v2 · server-side page snapshots
· Stripe (until metering data says what a user costs) · re-indexing the 4,971
context-free chunks (until the eval fixture exists) · `full_text` backfill (measured
as not worth doing).

