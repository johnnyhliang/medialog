# Docs index — what to trust

**Audited 2026-07-29.** 55 docs / ~406 KB accumulated over two months. Most are
historical. This page says which are current, which are history, and which are
actively misleading if read without context.

Every spec in `superpowers/specs/` now carries an `[Audit 2026-07-29]` banner with
its real build state. **Nothing was deleted** — stale docs were annotated, not
removed, because the reasoning in them is often still valid even when the status
line isn't.

---

## Read these first (current + accurate)

| Doc | What it's for |
|---|---|
| **`../PROJECT-STATE.md`** | **Start here.** Build state, deployment truth, what's broken vs unbuilt. Regenerated, never appended. |
| `../CHANGELOG.md` | What shipped, with the rationale that isn't recoverable from a diff |
| `tech-debt.md` | Known problems ranked by impact. Includes the ⚠️ top-priority item |
| `../IDEAS.md` | Proposals and open threads. Explicitly *not* a spec |

## Ready-to-build specs (written recently, nothing stale)

| Doc | State |
|---|---|
| `metering-analytics-spec.md` | Not built. **Blocking for signups** — AI runs unmetered today |
| `preservation-v2-spec.md` | Not built. Supersedes the server-side archiver plan |
| `interview-progress-spec.md` | Algorithm built (`src/lib/interviewPlan.js`); UI pending |
| `intentional-app-spec.md` | Part 2 (modules) **built**. Parts 1 (reminders) + 3 (Today) not |

## Accurate reference for how things work

| Doc | Subject |
|---|---|
| `superpowers/specs/2026-07-15-chunk-retrieval-design.md` | **How semantic search actually works.** Best doc in the repo for this |
| `deploy.md` | Two HTML entry points, `/app` + `/settings` routing, edge-function deploys |
| `PROJECT.md`, `VISION.md` | Philosophy and product thesis. Durable |
| `self-study-system.md` | Conventions, not schema. Deliberately no code |
| `ai-setup.md`, `ios-shortcut-setup.md`, `hotlinking.md` | Operational how-tos |
| `public-sharing-spec.md` | Built; matches reality |

---

## Read with care

**`superpowers/specs/2026-06-20-wayback-archive-design.md`** — built **and broken**.
The code records archival successes it never verified. Read
`preservation-v2-spec.md` §2 before touching it.

**`superpowers/specs/2026-06-23-product-holes-polish-plan.md`** (570 lines) and
**`2026-06-17-ui-polish-plan.md`** — mixed. Many items were fixed in the weeks
since; nothing tracks which. Re-audit checklists, not to-do lists.

**`superpowers/specs/2026-06-23-supabase-key-migration.md`** — **not done**, and it
may predate Supabase's final key naming. Verify against current guidance first.

**Two near-identical roadmaps** exist (`2026-06-17-strategic-roadmap.md`,
`2026-06-21-strategic-roadmap.md`). Both predate the current direction. Kept for
history; `PROJECT-STATE.md` is authoritative.

**`marketing-launch-plan.md`** (430 lines) — written before tiers, metering and
preservation v2 existed. Positioning is likely still sound; anything about
features or pricing needs re-checking against current state.

**`HANDOFF.md`** — a point-in-time handoff, now superseded by `PROJECT-STATE.md`.

---

## The trap this audit was fixing

Several specs said **"Approved, pre-implementation"** or **"Idea / Future
Consideration"** for features that shipped weeks ago —
`2026-06-19-entry-version-history.md` was the worst, marked *Idea* while
`VersionHistoryModal.jsx` has been in the tree and tested for over a month.

The inverse also existed: **`2026-07-17-goals-tracker-design.md`** looked buildable,
and `src/lib/goals.js` exists — but **nothing imports it**. A library with no
consumers isn't a feature.

**Lesson for future specs:** the status line is the first thing to rot and the last
thing anyone updates. Trust the codebase; treat a status line as a claim to verify.
Verifying takes one `grep`.

---

## Docs that are pure history

Safe to skip unless you want the reasoning behind an old decision. All are
annotated with their build state:

`2026-06-07-medialog-design.md` (the founding design — built) ·
`2026-06-15-medialog-ultimate-vision.md` · `2026-06-21-semantic-search-design.md`
(built then superseded) · `2026-06-19-tuxedo-analysis.md` ·
`2026-06-22-design-vision.md` · `2026-07-20-plan2-activation-scope.md` (done) ·
plus the ~15 other `[Audit]`-banner **BUILT** specs, which are now records rather
than plans.

## Specs for things genuinely not built

`2026-07-17-collections-embedded-views-design.md` ·
`2026-07-17-table-grid-editor-design.md` ·
`2026-07-17-live-preview-slash-commands-design.md` ·
`2026-07-20-episodic-extraction-design.md` ·
`2026-06-19-anti-clutter-quality-gates.md` ·
`2026-06-28-video-archiver-design.md` (superseded by preservation v2) ·
`2026-06-25-ai-agent-rag-design.md` (steps 3–5 deferred) ·
`2026-06-21-mcp-v2-design.md` (deferred)
