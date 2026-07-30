# MediaLog — Project State

**Regenerated 2026-07-29** from the filesystem and git, not from memory.
**Overwritten on each regeneration, never appended** — an append-only log is always
partly wrong; a snapshot is always current.

Companions: `CHANGELOG.md` (what shipped + why) · `docs/README.md` (which docs to
trust) · `docs/tech-debt.md` (severity-ranked problems) · `IDEAS.md` (proposals).

**Hard numbers:** 61 migrations · 15 edge functions · 69 components · 48 lib modules
· 109 test files / 603 tests passing · 55 docs (~406 KB).

---

## 1. Deployment truth — what is actually live

| Layer | State |
|---|---|
| `master` | `4057f98`, pushed |
| Frontend | auto-deploys on push |
| Migrations applied | through `0061` |
| **Migrations NOT applied** | **`0062` (billing), `0063` (capture tokens)** |
| Edge functions | `enrich` redeployed today |
| **Edge functions NOT deployed** | **`capture`** — working tree accepts tokens, deployed version does not |
| `0059` | permanently skipped (parallel worktrees claimed numbers out of order) |

**Consequences of the two gaps.** Until `0063` is applied and `capture` deployed,
the token path silently does nothing and the shared-secret path is still the only
auth. Until `0062` is applied, `scripts/set-tier.js` fails (`set_tier_manual` does
not exist), so **paid surfaces cannot be tested at all**.

---

## 2. Mid-development — code that exists but is not reachable by a user

The largest source of "did that get built?" confusion. All of it is real, tested,
committed — and **nothing in the UI imports it**.

| Module | Lines | What's missing | Spec |
|---|---|---|---|
| `src/lib/interviewPlan.js` | 210 | Readiness rings, staleness dot, gap list, target-date + focus editor | `docs/interview-progress-spec.md` §4 step 4 |
| `src/lib/db/studyPlan.js` | 33 | Same UI as above; `prep_target_date`/`prep_focus` are never read | same |
| `src/lib/billingPlan.js` | 121 | Everything — **inert by design** until billing is turned on | — |
| `src/lib/db/captureTokens.js` | 64 | Settings UI to mint/revoke; bookmarklet still emits the old secret | `docs/preservation-v2-spec.md` §1 |
| `src/lib/goals.js` | 85 | Entire feature. Pure lib, no migration (goals = entries w/ frontmatter) | `docs/superpowers/specs/2026-07-17-goals-tracker-design.md` |
| `src/lib/preservation.js` | 48 | `preservationPatch` **is** wired; `preservationCoverage` has no UI (◆ marker, "N of M preserved") | `docs/content-preservation-plan.md` T3 |
| `scripts/backfill-full-text.js` | 224 | Never run against real data | same |

**Likely dead, not mid-development — needs a decision:**
- `src/lib/fetchFeed.js` (86 lines) — client-side RSS fetching, almost certainly
  orphaned when feeds moved server-side to `fetch-feeds` (`fbdc2d7`). **Verify then
  delete.**
- `src/lib/retrievalEval.js` (38 lines) — no importers; probably a one-off harness
  from the chunk-retrieval work.
- `src/components/LandingPage.backup.jsx` (570) + `src/landing.backup.css` — dead
  backups; git holds the history.

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

→ **You cannot charge anyone today**, and the tier boundary is untested end-to-end.

### 3.2 Analytics — 1 of 3 phases
| Phase | State |
|---|---|
| Events (`0058`, `track.js`) | ✅ live, collecting since today |
| **AI metering (`ai_usage`)** | ❌ **blocking** — `docs/metering-analytics-spec.md` §2 |
| Admin dashboard | ❌ correctly last — same doc §4 |

**Gap detail:** `supabase/functions/ai/index.ts` authenticates the caller but does
not meter or rate-limit, and `embed-entry` likewise. One user can drain the shared
quota for everyone. No `ai_usage` table exists. **There is no cost-per-user number**,
which is the input both pricing and the YC narrative need.

### 3.3 Preservation — 1 of 4 tiers, one tier broken
| Tier | State | Spec |
|---|---|---|
| Images/PDFs (Phase 1) | ✅ `snapshots` bucket, `snapshot` fn | `docs/content-preservation-plan.md` |
| Article text | ✅ built, ⚠️ **extractor unverified** | same, part (a) |
| Public page fidelity (Wayback) | ⚠️ **built and broken** | `docs/preservation-v2-spec.md` §2 |
| Auth'd / JS-heavy pages | ❌ browser extension | same §1 |
| Video transcripts | ❌ edge function, no worker needed | same §3 |
| Video media | ❌ R2, opt-in | same §3 |

**Blocking dependency:** the extension **cannot** ship `VITE_CAPTURE_SECRET`
(extension bundles unpack trivially), so per-user capture tokens (§1 of that spec)
gate the whole client-capture line of work.

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

2. **`VITE_CAPTURE_SECRET` is in the client bundle.** Confirmed present in
   `dist/assets/SettingsView-*.js`. `capture/index.ts` also read `CAPTURE_USER_ID`
   from env, so every capture was attributed to one hardcoded account — a second
   user could post into the founder's library using a secret the bundle handed
   them. Fix written (`0063`, `db/captureTokens.js`, `capture/index.ts`) but
   **unapplied, undeployed, no UI**. Unsetting `CAPTURE_SECRET` is what closes it.

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

6. **`allorigins.win` SPOF** — anything still routing through the free CORS proxy
   dies when it does. Fix: fetch server-side (edge functions have no CORS limit).

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
| 1 | Apply `0062`+`0063`, deploy `capture`, build token UI | Finishes 70%-done work; retires a launch blocker; unblocks the extension | `preservation-v2-spec.md` §1 |
| 2 | Verify the Readability extractor | One capture + one query; retires the ⚠️ | `tech-debt.md` |
| 3 | **AI metering + cap** | Blocks tiering, pricing, signups | `metering-analytics-spec.md` §2 |
| 4 | Interview progress UI | Data flows now, so rings aren't theatre | `interview-progress-spec.md` §4 |
| 5 | Reminders + Agenda | Biggest product value; unblocked | `intentional-app-spec.md` Part 1 |
| 6 | Wayback SPN2 rewrite | Fixes a broken feature, no new infra | `preservation-v2-spec.md` §2 |
| 7 | Delete `fetchFeed.js`, `retrievalEval.js`, landing backups | Cheap; removes false signal | `tech-debt.md` |
| 8 | Split `App.jsx` along existing seams | Merge pain is already real | `2026-06-19-app-modularization-design.md` |

**Deliberately deferred:** agent steps 3–5 and MCP v2 (until the seams they depend
on stop moving) · server-side page snapshots (replaced by the extension) · Stripe
(until the app stabilizes).
