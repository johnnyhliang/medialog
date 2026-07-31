# MediaLog — Project State

**Regenerated 2026-07-30 (operator tooling + indexing cost)** from the filesystem
and git, not from memory. **Overwritten on each regeneration, never appended** — an
append-only log is always partly wrong; a snapshot is always current.

Companions: `CHANGELOG.md` (what shipped + why) · `docs/README.md` (which docs to
trust) · `docs/tech-debt.md` (severity-ranked problems) ·
`docs/indexing-architecture.md` (how search indexing works + what it costs) ·
`PRODUCTION.md` (cost model, scaling, closed-source list) · `IDEAS.md` (proposals).

**Hard numbers:** 69 migrations · 16 edge functions · 73 components · 52 lib modules
· 116 test files / 691 tests passing · 99 docs.

**Git in the situations this repo gets into → [`docs/git-learning.md`](docs/git-learning.md).**
Written from the real tangle on 2026-07-30 (two sessions in one working tree, a
stray `main` branch, a rebase blocked by an untracked `CLAUDE.md`). Covers reading
ahead/behind, why `git add -A` is dangerous here, what to do when a rebase stops,
and the escape hatches. The codebase was never broken — 696 tests and the build
passed throughout, and everything is on `origin/master`.

also for ai search it doesnt have to run search every time unless the prompt specifies something like that

deleting past ai conversation needs a confirm

export button click should not automatically pull up the ui

everything is ridiculously slow to load even the metrics page

no way to save edits in settings appearance stays but programs nah need a button

distinction for search within a topic not searching outside the topic is kind of weird and implicit definitely need to do some design there

in feed the sort by should stay to a writer or source when you click it instead of generalized unless you go to some home page or something also some way to undo the floor? recommend problems? keep going - definite unsolved and some notes below


# Feed engine stuff:
The actual problem: Deep Topics being a separate topic kind, hidden from the main grid, was the mistake. It forces "PyTorch internals" to live in a different universe than "ML," when in your head they're the same thing — ML is one topic, and sometimes part of what's in it is structured (reading through TVM chapter by chapter) and most of it isn't (random saved links, quick notes). Two containers for one mental bucket is exactly the kind of fragmentation the whole app is designed against.

My call: collapse it. Any topic can optionally carry one or more resources (a resource = a source + an ordered outline + a cursor). No more kind: 'deep' silo, no more separate hidden-from-grid view:
- "ML" stays one topic. It has your usual scattered entries, plus zero or more active resources (e.g. "TVM paper," "ONNX spec") each with their own outline/cursor.
- A takeaway written against a resource section is a normal entry in that topic's list — same grid, same search — just carrying a small tag ("TVM · §3") instead of living in a walled-off tab. Clutter is handled by making that tag a filter, not a separate universe.
- Quant stops being special-cased too: "Quant" becomes a topic with its own resource (the order-book build, with build-rung "sections") plus the Strand B/C reading reps as either a second lightweight resource or just plain entries. One mechanism, not three.
- The picker's job barely changes: instead of "pick a Deep Topic vs a menu_item," it's "pick a topic with an active resource whose cursor has a next todo section" — same rotation/staleness logic, one less concept to keep straight.

This does mean reworking what's already shipped (topics.kind, DeepTopicView as an isolated page, the listTopics filter) rather than just extending it — real but contained: resource_sections mostly stays, DeepTopicView's outline+cursor UI becomes a panel inside the normal topic view instead of its own route, and the grid-hiding filter goes away entirely.

On recommended content / other takes — that's a genuinely different capability, not a picker tweak: it's the Feed engine (already built, quality-gated RSS/HN/Reddit ingestion) getting a topic-aware mode. Two pieces, both additive, neither blocks the above:
1. Passive boost: feed ranking already has a designed-t_focus layer (north-star Part 5) — once a topic has an active resource, items related to it should rank higher in your regular feed, so "other takes" surface on their own during Drift-mode browsing instead of requiring you to ask.
2. Active pull: a "find more like this" action on a toh (reuses the RAG/agent infra already spec'd) and drops candidates into that topic's backlog for you to skim — never auto-added, always your call to promote.

I'd sequence it: unify the topic model first (it's a correction, and everything else — picker, recommendations — is easier to reason about with one topic shape instead of two). Recommended content is real scope worth its own pass after.

not sure how much of this is built out/fully functional
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
| `master` | 4 commits **UNPUSHED** — held at the user's request, see below |
| Frontend | auto-deploys on push — **the batch-size change ships with the next deploy** |
| Migrations applied | **through `0069` — all current** (`0070` is the parallel window's, uncommitted) |
| Edge functions | **16**, `admin-metrics` redeployed with audit/activation/probe |
| `capture` auth | **verified live**: rejects bogus/absent/wrong credentials |
| `0059` | permanently skipped (parallel worktrees claimed numbers out of order) |

**Unpushed local commits** (`704c478`, `ca0e8d0`, `0e3a9cd`, `352ee67`). A
parallel session created a remote `main` branch and merged it to `master` via
PR #5; local `master` sits on top of `main`'s history. Decided: **`master` stays
trunk, `main` was a one-off.** To land: `git pull --rebase origin master`, push.

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

### 3.5 Everything else not built
`ai_usage` · admin dashboard · import queue (should share one table with
preservation jobs) · topic synthesis (`IDEAS.md` ①) · wikilinks/backlinks (②) ·
audio overview (③) · graph view (④) · collections · table/grid editor ·
slash commands · episodic extraction · agent steps 3–5 *(deferred)* · MCP v2
*(deferred)*.

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

**`src/App.jsx` — 1332 lines, 55 handlers, 26 `view ===` branches.** Hook
extraction moved *state* out but left *orchestration*. Evidence it is costing real
time: three parallel branches edited this file in one session and merged by luck,
not design. Seams that already exist: `useShareTarget`, `useOAuthCallback`, and a
routing module owning the view ladder. → `docs/superpowers/specs/2026-06-19-app-modularization-design.md`

**`src/styles.css` — 5422 lines / 153 KB.** The whole design system in one file,
and every feature appends (three separate blocks today). Split into tokens →
layout → per-view. No framework needed; the CSS is fine, the packaging isn't.

**`EntryCard.jsx` (704)**, **`SettingsView.jsx` (636)**, **`FeedView.jsx` (518)** —
each doing several jobs. `SettingsView` now has 13 tabs and inlines the bookmarklet
template, the Wayback bulk submitter, and the modules tab.

**Two competing gating mechanisms remain.** The three-layer model is authoritative,
but `showFounderUploads` still resolves independently inside `NoteEditor.jsx` via
its own `getUser()`. The `uploads` module exists in the registry and is unused.
Uploads stay RLS-enforced regardless, so this is tidiness, not a hole.

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

## 6. Ranked next actions

| # | Action | Why | Spec |
|---|---|---|---|
| 0 | **Push the 4 local commits** | `git pull --rebase origin master` first | — |
| 1 | Capture 2–3 prose articles, run `check-preservation.js` | Two minutes; retires the last ⚠️ | `tech-debt.md` |
| 2 | **Write `index_status = 'pending'`** | ~5 lines; closes the mid-import blind spot (4.1b) | `indexing-architecture.md` |
| 3 | **Eval fixture** (~20 query/entry pairs) | Harness exists, fixture doesn't. Gates the re-index decision. ~half a day | `indexing-architecture.md` §2 |
| 4 | **`jobs` table** (task #5) | The keystone. Unblocks invisible indexing, safe bulk import, meterable indexing, AND the graceful quota path — deferred work needs somewhere to pause | `indexing-architecture.md` §3 |
| 5 | Two-phase indexing | Rides on the queue. Makes contextualisation tier-differentiable and interruptible | `indexing-architecture.md` §4 |
| 6 | Set `aiCallsPerWindow` from real data | Still `null`. Needs ~a week of `ai_usage` | `limits-runbook.md` |
| 7 | Reminders + Agenda | Biggest product value; unblocked | `intentional-app-spec.md` Part 1 |
| 8 | Interview progress UI | Data flows now, so rings aren't theatre | `interview-progress-spec.md` §4 |
| 9 | Wayback SPN2 rewrite | Fixes a broken feature, no new infra | `preservation-v2-spec.md` §2 |
| 10 | Split `App.jsx` (1343 lines) | Merge pain is already real — proven again this session | `2026-06-19-app-modularization-design.md` |
| 11 | Split `styles.css` (5771 lines) | Every feature appends to one file | `tech-debt.md` |

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

