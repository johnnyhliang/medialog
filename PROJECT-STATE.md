# MediaLog — Project State

### unreachable code for refactor plan:
stuff like interview readiness, goals.js, metering features, to be checked later

**Updated 2026-08-06 (UX bugs + backup coverage)** from the filesystem and git, not
from memory. **Overwritten on each regeneration, never appended** — an append-only
log is always partly wrong; a snapshot is always current.

Companions: `CHANGELOG.md` (what shipped + why) · `docs/README.md` (which docs to
trust) · `docs/tech-debt.md` (severity-ranked problems) ·
`docs/indexing-architecture.md` (how search indexing works + what it costs) ·
`PRODUCTION.md` (cost model, scaling, closed-source list) · `IDEAS.md` (proposals).

**Hard numbers (recounted 2026-08-07):** 74 migrations (`0076` is the highest;
`0059` was never used) · 16 edge functions · 89 components · 81 lib modules ·
121 test files / **880 tests passing** · 103 docs · `App.jsx` 1517 lines ·
`styles.css` 6099 lines.

`App.jsx` and `styles.css` both grew again this session (+197 / +315) and both
are already logged in `tech-debt.md` as monoliths. Noting the direction because
a number that only ever goes up is a decision nobody is making.

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

## 0. Session synthesis — 2026-08-06 (docs consolidation + backup format)

**Shipped:** the profile-field backup fix and its boundary enforcement · a manual
QA checklist · one ranked backlog · `IDEAS.md` as the proposal registry · 18
corrected spec statuses · the editions split · changelog brought current.

Decisions that are not recoverable from the diff:

- **Storage today counts only the `snapshots` bucket.** `my_storage_bytes()` sums
  file bytes; notes, `full_text`, versions and all 4,976 embedding chunks count as
  **zero**. The 500 MB / 10 GB limit is a file-storage limit wearing the name
  "storage". **If it ever becomes one pool, do not count embeddings against the
  user** — they are derived and unchosen, and charging for them repeats the
  mistake the AI-quota decision already rejected ("importing your library must not
  exhaust your ability to ask questions about it").
- **A credential allowlist must be enforced where bytes leave**, not upstream. It
  lived in `collectSnapshot` only, so `buildFiles` wrote whatever it was handed —
  a caller with a fuller row would have written `github_token` into a git repo.
- **"Does anything import this file" is the wrong question** for unreachable code.
  Per-export counting moved `interviewPlan.js` from "wholly unreachable" to "two of
  eight live" — see §2.
- **Every table and column must be *classified*, not necessarily backed up.**
  Carried, or excluded with a stated reason; tests parse the migrations and fail on
  anything unclassified. Seven tables and four profile fields had gone missing with
  nothing failing.
- **`IDEAS.md` is the proposal registry; §6 is the only ranking.** Six fully-specced
  features had no entry in `IDEAS.md` at all — the proposals developed *furthest*
  were invisible when browsing ideas. Two shadow lists were deleted rather than
  updated.
- **Self-hosted constraints are a bug, not a courtesy** (`docs/editions.md`). Nearly
  every quota exists because someone else pays, others share the blast radius, or
  the operator is liable. None hold for one person on their own machine.
- **Background work that fails into silence is one architectural gap, not six bugs**
  — hence the activity log proposal, scoped to what happens *without* you.

Corrections issued this session: `archive_toast` **did** persist (to the database
all along; what it lacked was a synchronous first paint) — an earlier note here
claiming otherwise was wrong. And rolling back to a remembered previous value is
not a valid revert when a field fires a change per keystroke.

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

**Resolved 2026-08-07: Supabase automatic backups are ENABLED.** This was §6 row 0
— the longest-standing open item and the only one no amount of code could close.
The application-level backups (GitHub sync, local zip) were never a substitute:
they carry authored data by an explicit allowlist, not the database, so they
cannot restore auth, RLS policies, functions or anything outside `SYNC_TABLES`.

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
| Migrations | ✅ **`0071` applied and verified 2026-08-06** via `supabase migration list --linked` — every migration matches Local and Remote, no drift |
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

**Re-measured 2026-08-06 per *export*, not per file** — which changed one answer.
Counting whole modules said "nothing imports it"; counting exports shows two of
these are partly live, and the dead part is the specific feature, not the module.

| Module | Exports used | Actually missing | Spec |
|---|---|---|---|
| `src/lib/interviewPlan.js` (249) | **2 of 8** — `suggestNext` (5 uses) and `dueReviews` (3) are **live in `GainsCard.jsx`** | ⚠️ **Correction: this was listed as wholly unreachable and is not.** The unused six are exactly the readiness surface: `patternStaleness`, `remainingProblems`, `paceStatus`, `actualWeeklyRate`, `trackWeightsFromFocus`, `identifyGaps` | `docs/interview-progress-spec.md` §4 step 4 |
| `src/lib/db/studyPlan.js` (32) | **0 of 2** | Whole module. `prep_target_date`/`prep_focus` are written by nothing and read by nothing — though they *are* now carried in backups | same |
| `src/lib/goals.js` (84) | **0 of 6** | Entire feature. Pure lib, no migration (goals = entries w/ frontmatter) | `2026-07-17-goals-tracker-design.md` |
| `src/lib/billingPlan.js` (120) | **0 of 3** | Stripe webhook + checkout. **Inert by design** — the status→tier mapping is done and tested, waiting on a decision, not on code | `docs/metering-scope.md` |
| `src/lib/preservation.js` (48) | **1 of 2** — `preservationPatch` has 4 callers | `preservationCoverage` has no UI (the ◆ marker, "N of M preserved") | `content-preservation-plan.md` T3 |
| `src/lib/retrievalEval.js` | 0 importers **by design** | Nothing. It is a tuning harness you run, like a script — **not dead code**, and this has been mistakenly flagged before | `indexing-architecture.md` §2 |
| `scripts/backfill-full-text.js` (224) | n/a | Never run against real data | `content-preservation-plan.md` |

**The lesson worth keeping:** "does anything import this file" is the wrong
question. A 249-line module with two live exports reads as reachable at file level
and as fully built at feature level, and it is neither. Ask per export.

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

3. ~~**Wayback records unverified successes.**~~ — **NO LONGER USER-VISIBLE
   2026-08-06.** `submitArchive` is a bare `window.open`; the caller wrote
   `wayback_submitted_at` regardless, and the bulk submitter then **permanently
   skipped** those entries — an unverified guess made permanent. One `catch`
   collapsed rate-limit / CORS / timeout / malformed into a single `'error'`
   indistinguishable from "not archived", which is the ambiguous UI you noticed.

   **The UI is gone, the defect is not fixed.** The entry-card button and popup
   are unmounted and the bulk submitter is deleted (recover with
   `git log -S handleBulkArchive`), so nothing claims a preservation that was
   never verified. `checkArchive` was always sound — it queries the availability
   API and returns a real answer; only the *submit* half is untrustworthy.
   `wayback_submitted_at` is deliberately retained so a future SPN2 pass knows
   which entries to re-check rather than re-submitting blindly.

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
| What to click through by hand | `docs/qa-checklist.md` | manual verification |
| Bugs & things already wrong | `docs/tech-debt.md` | severity-ranked defects, incl. § *Reported UX problems* |
| Feature proposals | `IDEAS.md` | roadmap ①–④, Big swings, cuts |
| The north star | `docs/superpowers/specs/2026-07-04-north-star-experience-design.md` | four moods, Manager, `user_model`, build order ①–⑧ |
| Where it is *now* | §§1–5 above | deployment truth, gaps, known-broken, architecture |
| What already shipped | `CHANGELOG.md` | history + why |
| Which of the 100 docs to trust | `docs/README.md` | the index |
| Cost, scaling, launch checklist | `PRODUCTION.md` | incl. the **unchecked** backups box |
| Hosted vs self-hosted split | `docs/editions.md` | what differs per edition |

### Ranked

| # | Action | Kind | Why | Detail |
|---|---|---|---|---|
| ~~0~~ | ~~Turn on Supabase automatic backups~~ | ops | ✅ **DONE 2026-08-07.** Enabled in the dashboard. The one item on this list that no code could close, open since the list was written | `README.md` § *Not losing your data* |
| ~~1~~ | ~~Confirm `0070`/`0071` are applied~~ | ops | ✅ **DONE 2026-08-06.** `supabase migration list --linked` shows every migration in both Local and Remote, no drift | — |
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
| ~~12~~ | ~~Reminders + Agenda~~ | feature | ⛔ **SUPERSEDED 2026-08-07 → row 15.** Built and **parked** (beta-gated, invisible). Due dates as the primary surface contradict `gains-system.md`; the replacement is *a topic is the project*, plan in `master_doc`, aggregated by the Manager. `due_at` + `src/lib/timezone.js` retained | `manager-scope.md` |
| 13 | Tidy queue (north-star ①) | north star | One-card triage; queries already exist, it's a card UI | north-star spec Part 6 |
| 14 | Related-entries footer (north-star ④) | north star | pgvector exists; agent step ① as visible value | north-star spec Part 6 |
| ~~15~~ | ~~Manager + resume cards~~ | north star | ✅ **DONE 2026-08-07 — all seven steps of `manager-scope.md` §10.** Cards, `[park]`, derived momentum, tickable plan steps, the contribution grid, the seeded plan, and AI drafting. Originally: The genuinely missing surface, and the one that answers "important things drown on the backburner": `[park]` kills cold-topic guilt, momentum is *derived* so nothing is hand-prioritised, and it aggregates 24 modules into one place to look. Absorbs rows 12, 17, 18 and both dead progress libraries (`goals.js`, `studyPlan.js`) | **`manager-scope.md`** · north-star spec Part 2 |
| 16 | `user_model` v1 + feed ranking (north-star ⑥) | north star | **Start logging the dismiss signal now — it's free and it's the input** | north-star spec Part 5 |
| ~~17~~ | ~~Collapse Deep Topics~~ | feature | ✅ **DONE 2026-08-07 — as a DELETION.** The warning here ("the cursor is the only 'where did I leave off' mechanism") was written from the code, not the data. Live check: `resource_sections` 0 rows, `cursor_section_id` 0 set, `takeaway`/`section_id`/`parent_id` 0. There was no cursor to preserve. ~600 lines removed; **no schema dropped** (`0075` is one UPDATE). `GainsCard`'s dev track was rewired to `master_doc` steps | `manager-scope.md` §4 |
| 18 | Interview progress UI | feature | Data flows now, so rings aren't theatre | `interview-progress-spec.md` §4 |
| ~~19~~ | ~~Hide the Wayback UI~~ | bug | ✅ **DONE 2026-08-06.** Entry-card button and popup unmounted, bulk submitter removed. `wayback_submitted_at` **kept** — a future SPN2 pass needs it to know which entries to re-check. SPN2 itself stays parked | `IDEAS.md` § External archival |
| 19b | Video capture: transcript + metadata + thumbnail | feature | One fetch at capture time. Transcripts are plain HTTP (~50 KB, no worker) and are *the information* for a talk; stored thumbnails survive deletion, which hotlinked ones cannot. ~$1.30 to backfill 185 YouTube entries | `preservation-v2-spec.md` §3 |
| 19c | Background activity log | infra | The structural fix for this codebase's defining failure mode — background work that fails into silence. `capture_log` is already this for one case | `IDEAS.md` § Background activity log |
| 20 | Undo the feed floor / recommend problems | design | Open question, unsolved | `tech-debt.md` § UX #8 |
| 20b | **Pull 18 components back through the db layer** | debt | Measured 2026-08-07: 124 `.from()` calls in `src/lib/db/` and **18 components query Supabase directly anyway**, so the same filters get re-typed and drift, and a self-fetching component can't be unit-tested. Own pass, own commit — **do not fold into a feature**. Mechanical, delegable | `tech-debt.md` § Query sprawl |
| 20c | Test `TidyView` | debt | The only untested view, and after the Triage merge it is the single triage surface on the core loop. Blocked-ish on 20b: move its fetch to the db layer, then test it there with `mockSupabase` | `tech-debt.md` |
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

**Parked 2026-08-06, after costing them out — decided, not forgotten:**

- **Video capture (19b): stored thumbnails, transcripts, liveness.** Parked
  *because the analysis came back cheap*, which removes the urgency rather than
  creating it. Today's approach — `enrich` stores an `og_image` **URL** and the
  card hotlinks it — costs ~100 bytes an entry and **zero egress**, because the
  browser fetches from `i.ytimg.com` directly. The only real defect is durability:
  a hotlinked thumbnail dies with the video, and you cannot store a copy
  retroactively. Numbers if it is picked up: ~30 KB per thumbnail (~5.5 MB for the
  185 existing YouTube entries), transcripts ~50 KB each over plain HTTP with no
  worker, ~$1.30 to index them all. **Non-issue at this scale; revisit before any
  large video import.**
- **External archival (19): now "hide the Wayback UI", nothing more.** The idea has
  real merit — a copy you don't host, zero storage, a citable URL — and is written
  up in `IDEAS.md` § *External archival*. It is not being built now. The only
  action retained is removing the UI that claims successes it never verified,
  because an unverified submission is worse than none: it reports safety that does
  not exist and is discovered only when you needed the copy.

### Deferred 2026-08-07 — decided, not forgotten

Everything set aside during the Manager scoping pass, so none of it is lost:

- **Query consolidation (row 20b)** — kept out of the Manager work on purpose.
  Standing rule while it waits: *new work does not add to the 18*.
- **Digest + Progress merge** — deferred until the Manager exists. They share a
  mood, not a shape (Digest is actionable, Progress is read-only stats), so
  pairing them today is shuffling. Reconsider all three together once the
  Manager owns "state of my world". `manager-scope.md` §5 stage 4.
- **Whether the reading / deep-topics flow is wanted at all** — there is no
  deep-topics data, so it may be a feature built and never used. If so, step 4
  is a straight ~280-line deletion rather than an absorption. Decide *after*
  using the Manager. `manager-scope.md` §10.
- **The Agenda** (row 12) — built, beta-gated, invisible. `entries.due_at`
  (`0072`) and `src/lib/timezone.js` (`0073`) retained: `target:` dates need the
  same column and the same day-boundary math.
- **Layout at 400 ms pre-FCP** — the largest remaining block after the bundle
  work, and unmoved by it. First evidence that could implicate `styles.css`
  (row 22), but unmeasured. Measure before touching a file ranked as
  maintainability rather than speed.
- **`NoteEditor` chunk is 657 KB** and trips Vite's warning alone. Off the
  critical path since the lazy-boundary work, but it is what you wait for when
  you click into an editor.
- **Four status enums / seven progress mechanisms** — recorded so the count stops
  growing, not scheduled. `tech-debt.md`.

## Session synthesis — 2026-08-07 (the Manager, finished)

All seven steps of `docs/manager-scope.md` §10 landed. Read that document first;
this is only what is not recoverable from it or the diffs.

- **`goals.js` died the first time because nothing could tick a checkbox.**
  `toggleStep` had been exported, tested and called by *nothing* since July, so
  every progress bar in the app could only ever read 0/N. The library was not
  abandoned for being wrong — it was abandoned for being unreachable by one
  missing input control. That is now the Manager's plan panel, and it is also
  what gives the contribution grid something to record. **Before writing another
  derivation library, check that a human can produce its input.**
- **The data disagreed with the doc, and the data won.** §4 stated flatly that
  deep topics must be absorbed because `cursor_section_id` was "the only 'where
  was I' mechanism in the app". Querying it: 0 sections, 0 cursors, 0 takeaways.
  The mechanism existed in code and never in practice. §4's warning was written
  by reading files, which is exactly the failure mode §2 of this document already
  names. **Query production before honouring a doc's warning about production.**
- **Three half-built deadline mechanisms, zero behaviour.**
  `DeadlineAlertBanner.jsx` was imported by nothing, `programs.window_open` was a
  settings toggle whose only reader was that dead banner, and every program row
  had `deadline: null`. Each piece looked finished in isolation. This is the same
  shape as `renderReadme` (§0a) and now `toggleStep` — **the third instance, so
  it is a pattern, not a coincidence: this codebase reliably builds mechanisms
  and forgets the one wire that makes them live.**
- **"No due dates" needed an exception, and drawing it was the useful work.**
  §8's rule is about *learning* — a shaming number on a date nobody set. It does
  not transfer to a window that closes. The test now written down: someone else
  set it and it closes → a deadline, `career` may show it; you set it to pace
  yourself → a target, quiet chip, nothing else.
- **The AI step was built last and stayed small on purpose.** One button, only on
  cards with no next action, drafting into an *unsaved* field. It never writes,
  never ranks, never runs unprompted. `cleanDraft` rejects rather than repairs —
  a truncated half-sentence reads worse than nothing.

**Numbers:** 731 → 880 tests. Migrations `0072`–`0076`. ~600 lines deleted with
the reading UI; nothing dropped from the schema.

**Migrations `0075` and `0076` are written but NOT applied** — this project has
no `DATABASE_URL` or Supabase CLI config, so they are applied by hand in the
dashboard SQL editor. The grid is inert until `0076` runs.

**Still deferred, unchanged:** query consolidation (row 20b), Digest + Progress
merge, TidyView tests.

**Deferred with a named trigger: orphaned schema → a future migration, before production.**
(Previously earmarked `0077` — that number went to the `programs` RLS fix
below instead, 2026-08-11. The next one takes this.)
The reading-UI deletion stranded `resource_sections` plus seven columns
(`topics.kind` / `.cursor_section_id` / `.source_kind` / `.source_url`,
`entries.section_id` / `.parent_id`, `user_configs.twitter_token`) — all
verified as 0 rows and 0 code references against the live database. Deliberately
**not** dropped: `DROP COLUMN` is one-way and they cost nothing for one user. The
cost appears when other people are on the schema, so a migration drops them in
one pass before it ships, and not before. `entries.takeaway` is the exception
that needs a decision rather than a drop — it is still *read* by `chunkEntry.js`
and `githubSync.js` with no writer left. Full detail in `docs/tech-debt.md`.

**`0077_programs_writable.sql` (2026-08-11).** `0044`'s multitenant RLS audit
replaced `programs`' old ALL-policy with a SELECT-only one and never restored
write access. Settings > Programs' window-toggle, deadline edit, and add-program
form have been silently no-oping since — a Postgres UPDATE blocked by RLS with
no matching policy affects 0 rows and raises no error, so the optimistic UI
looked saved until the next reload reverted it. Same root cause class as the
`goals.js`/`DeadlineAlertBanner`/`window_open` pattern already logged
2026-08-07, new instance: **a control that writes to nothing, silently.**
Fixed with `for update`/`for insert using (auth.uid() is not null)`, matching
`opportunities`' shared-reference-data shape.

**And the perennial one, answered so it stops being re-asked:** the 74 migration
files cannot be reduced. They are an applied ledger in
`supabase_migrations.schema_migrations`; deleting a local file removes nothing
from the database and desynchronises the history. `db squash` is possible and is
the wrong trade. The clutter worth removing is in the schema, not the folder.

---

~~**Next session's intent: the Manager (§6 row 15).**~~ ✅ Done 2026-08-07 —
see the synthesis above. The §2 UI boundary held: `TopicView` was not touched.

**Seeded 2026-08-07 (`manager-scope.md` §10 step 5).**
`scripts/seed-quant-plan.js` turns `Documents/quantdevplan.xlsx` into real data:
three topics (Quant Dev Plan / Order Book (C++) / C++ Curriculum) with 49 plan
steps across their `master_doc`s and 15 entries, plus 14 firms into the existing
`applications` table. **No schema change** — the plan is checkboxes that
`goals.js` already parses, which is §2 working as intended. Idempotent; the
spreadsheet is no longer a stray file. Remaining: step 6 (contribution grid) and
step 7 (AI `next_action` drafting).

