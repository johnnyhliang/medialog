# MediaLog — Project State

**Regenerated 2026-07-30 (metering)** from the filesystem and git, not from memory.
**Overwritten on each regeneration, never appended** — an append-only log is always
partly wrong; a snapshot is always current.

Companions: `CHANGELOG.md` (what shipped + why) · `docs/README.md` (which docs to
trust) · `docs/tech-debt.md` (severity-ranked problems) · `IDEAS.md` (proposals).

**Hard numbers:** 61 migrations · 15 edge functions · 69 components · 48 lib modules
· 113 test files / 661 tests passing · 58 docs.

---

## 1. Deployment truth — what is actually live

| Layer | State |
|---|---|
| `master` | `4057f98`, pushed |
| Frontend | auto-deploys on push |
| Migrations applied | **through `0063` — all current** |
| Edge functions | **16** — `enrich`, `capture`, and the new `crawl-archive` all deployed |
| `capture` auth | **verified live**: token path deployed, rejects bogus/absent/wrong credentials with `Invalid or missing capture token` |
| `0059` | permanently skipped (parallel worktrees claimed numbers out of order) |

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

1. **⚠️ TOP — Readability extractor unverified.** Deployed today, but the
   `npm:@mozilla/readability` / `npm:linkedom` specifiers have **never resolved at
   runtime** (no local Deno). Imports are lazy + try/caught, so failure degrades
   *silently* to the old regex heuristic — nothing errors, quality just drops.
   **Verify:** capture an article, then
   `select url, full_text_extractor from entries where full_text_at > now() - interval '10 minutes';`
   `readability` = good, `heuristic` = the imports failed.

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

5. **Silent index staleness.** `chunkEntryAsync` never throws by design, and
   nothing records per-entry index status, so semantic search can go stale
   invisibly. `full_text_status` (`0060`) is the pattern to copy.

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
| 1 | Verify the Readability extractor | One capture + one query; retires the ⚠️ | `tech-debt.md` |
| 3 | **AI metering + cap** | Blocks tiering, pricing, signups | `metering-analytics-spec.md` §2 |
| 4 | Interview progress UI | Data flows now, so rings aren't theatre | `interview-progress-spec.md` §4 |
| 5 | Reminders + Agenda | Biggest product value; unblocked | `intentional-app-spec.md` Part 1 |
| 6 | Wayback SPN2 rewrite | Fixes a broken feature, no new infra | `preservation-v2-spec.md` §2 |
| 7 | Split `App.jsx` along existing seams | Merge pain is already real | `2026-06-19-app-modularization-design.md` |
| 8 | Split `styles.css` (5422 lines) | Every feature appends to one file | `tech-debt.md` |

**Deliberately deferred:** agent steps 3–5 and MCP v2 (until the seams they depend
on stop moving) · server-side page snapshots (replaced by the extension) · Stripe
(until the app stabilizes).
