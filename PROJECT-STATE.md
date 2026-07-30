# MediaLog — Project State

**Regenerated: 2026-07-29.** This file is **overwritten, never appended.** An
append-only log is always partly wrong; a regenerated snapshot is always current.
Derived from the filesystem and git, not from conversation memory.

Companions: `CHANGELOG.md` (what shipped, with rationale) · `IDEAS.md` (proposals)
· `docs/tech-debt.md` (what's wrong) · `docs/` (specs).

---

## 1. Deployment truth

| | State |
|---|---|
| `master` | pushed through `55b7a8d` (+ uncommitted capture-token work) |
| Frontend | deployed via host on push |
| Migrations | **0056–0058, 0060, 0061 applied.** `0062`, `0063` **NOT applied** |
| Edge functions | `enrich` redeployed 2026-07-29. **`capture` NOT redeployed** (has uncommitted changes) |
| Tests | 109 files / 603 tests passing |
| `0059` | permanently skipped — parallel worktrees claimed numbers out of order |

**Two things are half-shipped right now:**
- `0062` (billing harness) and `0063` (capture tokens) are written, not applied
- `capture/index.ts` accepts per-user tokens in the working tree but the deployed
  function still only accepts the shared secret

---

## 2. Specs → build state

The honest accounting. "Spec'd" means a design doc exists; most are **not built**.

### Fully built
| Spec | Where | Notes |
|---|---|---|
| Modularity (intentional-app Part 2) | `0057`, `src/lib/modules.js`, `entitlements.js`, `ModulesTab.jsx` | Shipped as 3 layers, not the doc's 1 — doc updated to say so |
| `full_text` hardening (preservation (a)) | `_shared/extractArticle.ts`, `0060`, `preservation.js` | Deployed but **extractor unverified** |
| Product events (metering spec §3) | `0058`, `track.js`, `queries/activation.sql` | Live and collecting |
| Chunk retrieval / semantic search | `content_chunks`, `chunkEntry.js`, `retrieval.js` | Pre-session; replaced whole-entry embeddings |
| Public sharing | `0055`, `public-share` fn | Pre-session |
| File archiver Phase 1 | `0054`, `snapshot` fn | Pre-session |
| GitHub sync | `githubSync.js`, `github-backup` fn | Pre-session |
| Agent steps 1–2 (read-only RAG) | `librarian.js`, `AssistantPanel.jsx` | Steps 3–5 deferred |

### Built as libraries, NO UI yet
| Thing | Where | Missing |
|---|---|---|
| Interview pace / gaps / suggestions | `src/lib/interviewPlan.js` (27 tests) | Rings, staleness dot, gap list, target-date + focus editor |
| Preservation coverage | `src/lib/preservation.js` | ◆ marker on entries, "N of M preserved" in Settings |
| Billing tier mapping | `src/lib/billingPlan.js` (14 tests) | Everything — inert by design |
| Capture tokens | `0063`, `db/captureTokens.js` | Settings UI to mint/revoke; bookmarklet still uses the old secret |
| `full_text` backfill | `scripts/backfill-full-text.js` | Never run |

### Spec'd, NOT built (14)
1. **AI metering + cap** — `docs/metering-analytics-spec.md` §2. *Blocking for signups.*
2. **Admin/analytics dashboard** — same doc §4
3. **Import queue** — task #5; should share a table with preservation jobs
4. **Reminders + Agenda** — `intentional-app-spec.md` Part 1
5. **Today / Morning Open** — same doc Part 3
6. **Browser-extension capture** — `preservation-v2-spec.md` §1
7. **Wayback SPN2 rewrite** — same §2 (current code is broken, see §5 below)
8. **Video transcripts** — same §3
9. **R2 opt-in media + `yt-dlp` runner** — same §3
10. **Agent tool layer steps 3–5** — deferred, `2026-06-25-ai-agent-rag-design.md`
11. **MCP v2** — deferred, `2026-06-21-mcp-v2-design.md`
12. **Topic synthesis** (summarize/briefing/timeline) — `IDEAS.md` ①
13. **Wikilinks + backlinks** — `IDEAS.md` ②
14. **Graph view / audio overview** — `IDEAS.md` ③④

### Not spec'd at all
Stripe integration & checkout flow · upgrade/downgrade UX · feed & archive agent
tools (the gap noted in the agent spec) · per-entry index status.

---

## 3. What the subagents actually produced

This is the part that got lost in chat. Both branches are **merged into `master`**.

**Agent A — `full_text` hardening** (branch `feat/full-text-hardening`, 3 commits)
- `supabase/functions/_shared/extractArticle.ts` — Readability with **DOM injected**
  so one module runs under Deno, Node and vitest. Chain: Readability → old regex
  heuristic → nothing, gated at 500 chars so paywall stubs fall through.
- `0060_full_text_coverage.sql` — `full_text_status` / `full_text_extractor` /
  `full_text_at` + partial index
- `src/lib/preservation.js` + tests
- `scripts/backfill-full-text.js` — resumable off the marker, `--rps` throttles
  **re-chunking inside the loop**, not just fetches
- Refactored `scripts/rechunk.js` (exported `processEntry`, lazy client)
- **Found a real bug:** `enrichEntries` only ran when title/image were missing, so
  bulk imports arriving *with* titles never preserved text at all
- Added `@mozilla/readability` + `linkedom` as devDependencies
- Left undone: the coverage UI, and a per-entry "preserve now" action

**Agent B — event tracking** (branch `worktree-agent-a54ac9a1c2e3ca0d8`, 2 commits)
- `0058_events.sql` — split insert-own / select-own, no update/delete (append-only)
- `src/lib/track.js` — 3s timer + `visibilitychange` + 100-row early flush
- `src/lib/track.privacy.test.js` — **deliberately a separate file** so the
  props-safety assertion can't be collateral damage of an unrelated edit
- `supabase/queries/activation.sql` — both activation metrics
- Judgment calls it made: `inbox_sorted` fires per filed entry with `{count:1}` and
  excludes sort-*delete* (rejection isn't library-building); the global search bar
  also emits `search_run`

Neither agent could claim its task (no task tools in worktrees) — I closed both.

---

## 4. Paid / accounts — ~40%

**Done:** `user_entitlements` (server-only writes, no forge path) · free/paid/founder
· per-module `minTier` · locked-with-upgrade rendering · founder derived from
`is_founder` · `0062` subscriptions + `sync_tier_from_billing` with the
founder-never-downgraded guard · `billingPlan.js` status mapping ·
`scripts/set-tier.js` harness.

**Missing:** Stripe integration · checkout · nothing is *actually* `paid` (assistant
sits at `founder` until metering exists) · **no cap enforcement, so paid grants
nothing free doesn't** · downgrade/expiry UX.

The skeleton is right; commerce and enforcement are absent. **You could not charge
anyone today.**

## Admin / analytics — 1 of 3 phases
- Events ✅ collecting · Metering ❌ **blocking** · Dashboard ❌ (correctly last)
- **AI still runs unmetered on one shared key.**

---

## 5. Known-broken (not just unbuilt)

1. **⚠️ Readability unverified.** Deployed; `npm:` specifiers never resolved at
   runtime. Lazy + try/caught, so failure degrades *silently* to the heuristic.
   Verify: capture an article, then
   `select url, full_text_extractor from entries where full_text_at > now() - interval '10 minutes';`
2. **`VITE_CAPTURE_SECRET` is in the bundle.** Confirmed present in
   `dist/assets/SettingsView-*.js`. Fix written (`0063` + `db/captureTokens.js` +
   `capture/index.ts`), **not applied, not deployed, no UI.**
3. **Wayback integration records unverified successes.** `submitArchive` is a bare
   `window.open`; the caller writes `wayback_submitted_at` regardless, and the bulk
   submitter then skips those entries forever. One `catch` collapses every failure
   into an ambiguous `'error'`.
4. **`mcp-server/` has ungated bulk writes.** Dormant (needs service-role key +
   wired client) but must be re-gated or stripped before connecting to anything.
5. **`App.jsx` god object** — 3 parallel branches edited it this session; they
   merged by luck.

Full list with severity: `docs/tech-debt.md`.

---

## 6. Next actions, ranked

1. **Apply `0062`/`0063`, deploy `capture`, build the token UI** — finishes work
   already 70% done and retires a launch blocker
2. **Verify the Readability extractor** — one capture + one query
3. **AI metering (#4)** — blocks tiering, pricing, and signups
4. **Interview progress UI** — data flows now, so rings aren't theatre
5. **Reminders + Agenda (#6)** — biggest product value; unblocked
6. **Wayback SPN2 rewrite** — fixes a broken feature, no new infra

Deliberately deferred: agent steps 3–5, MCP v2, server-side page snapshots
(replaced by the extension approach), Stripe.
