# Gains Feed — Design Spec

**Date:** 2026-07-30
**Status:** Draft (for review)
**Part of:** the "Gains System" vision (`gains-system.md`). This is **sub-project 2 of 2** —
named and deferred in `docs/superpowers/specs/2026-07-08-deep-topics-design.md` as "Spec 2."
Absorbs the interview tracker's algorithmic layer (`docs/interview-progress-spec.md`, built)
and extends it to the Quant and Dev tracks, which currently have none.

---

## 0. What already exists (verified)

| Piece | Where | State |
|---|---|---|
| Quant/Dev/Interview tracks, menu philosophy, dead-day floor | `gains-system.md` | markdown only, no DB |
| Interview readiness/staleness/pace/next-problem picker | `src/lib/interviewPlan.js`, `interview-progress-spec.md` | ✅ built (`04c5256`, `3799f83`) |
| Deep Topics: ordered sections + takeaway-first notes + cursor | `src/lib/db/deepTopics.js`, `0042` | ✅ built — this is Dev's Concept Bank container |
| `topic_state` / momentum (`warm/cooling/cold`) | north-star spec Part 2 | designed, not built |
| Digest cron (weekly narrative) | north-star spec Part 5 | designed, not built |
| Today-screen "finite, closeable" philosophy | `docs/intentional-app-spec.md` Part 3 | established pattern, reused here |

**The gap:** Interview got a scored next-item picker; Quant and Dev didn't. Quant's Strand
A/B/C items live only as markdown bullets — no DB rows, so nothing can be picked, logged, or
spaced. Dev's Concept Bank *is* a Deep Topic already, so it's structurally ready; it just isn't
plugged into a picker.

---

## 1. Scope

**Goal:** one daily "pull" across Quant + Dev + Interview that removes the decision of what to
work on next, without ever tracking pace, debt, or completion percentage for Quant/Dev.

**Explicit non-goal, stated up front because it's the one guardrail most likely to erode by
"helpful" analogy over time:**

> **No pace, no target, no "remaining," no "behind," no streak, anywhere outside the Interview
> track.** Interview pace (`prep_target_date`, `requiredRate` vs `actualRate`) is justified
> because it's opt-in and tied to a real external date the user chose. Quant and Dev must never
> grow an equivalent field. Do not add `remaining_count`, `expected_pace`, or any
> target-vs-actual comparison to Quant/Dev under any future request that frames it as "just like
> the interview tracker." This asymmetry is intentional, not an oversight.

---

## 2. Data model

### `menu_items` (new table — Quant's Strand A/B/C, currently markdown-only)

```
id            uuid pk
user_id       uuid not null            -- RLS
track         text not null            -- 'quant-build' | 'quant-read' | 'quant-mental'
title         text not null            -- e.g. "Add order cancellation"
status        text not null default 'open'   -- 'open' | 'done' | 'dropped'
position      int                      -- ordering within a strand (A is sequential; B/C are not)
last_pulled_at timestamptz             -- for rotation weighting
created_at    timestamptz default now()
```

Seeded once from `gains-system.md`'s current bullets (a one-time script, not a migration
requirement). `dropped` exists because the doc explicitly allows abandoning a menu item that
becomes annoying — dropping must be as frictionless as completing.

Dev needs no new table — its "chunks" are already `resource_sections` rows under the Active
Concept Bank Deep Topic(s); the picker reads `cursor_section_id` + the next `todo` section.

### Reused, unchanged

- `entries` (`takeaway`, `section_id`, `srs_interval`/`surface_after`) — a completed pull writes
  one entry, same shape as an interview problem-solve or a Deep Topic takeaway.
- `topic_state.momentum` (north-star, still to build) — three dots, one per track.

---

## 3. The picker (the algorithm)

Not readiness math — a **rotation + due-review scorer**, run once per "give me something" tap:

1. **Tier 1 — due SM-2 reviews win**, same rule as interview: any past one-liner/takeaway with
   `surface_after` in the past outranks a new pull, capped at the session (see §4). Re-deriving
   something already learned beats a first pass at something new.
2. **Tier 2 — track rotation.** Weight the three tracks by recency of last pull (`topic_state`
   / `menu_items.last_pulled_at`), so no track goes silent — never a fixed schedule, just
   "whichever's gone longest gets a nudge in the odds," matching "menu not checklist."
3. **Within Quant**, rotate strand A/B/C the same way — not round-robin, weighted-random so it
   stays a fridge, not a schedule.
4. **Within Dev**, take the next `todo` section of whichever Concept Bank topic is `Active`
   (reuses the existing cursor — no new logic).
5. **Bad-day path:** a separate, always-visible "floor" button bypasses the picker entirely and
   returns the three floor items verbatim from `gains-system.md` (2 min Zetamac / read one
   Harris paragraph; read one Concept Bank heading; read one NeetCode solution without solving).

**Anti-tunnelling, reused verbatim from the interview picker:** no more than 2 consecutive picks
from the same track; the set is finite (default 1 item, see §5 for overflow).

---

## 4. Feedback mechanism (motivation without a scoreboard)

Four layers, cheapest-first, all reuse existing infra or are byproducts of writing already
required by the reading loop:

1. **Gains Log, made real.** Every completed pull auto-appends one line (date · track · what got
   added) pulled from the entry/takeaway text just written — zero extra input. Answers "what got
   built," never "how much" or "how often." This is the highest-leverage single piece: a pile of
   built things beats a pile of check marks.
2. **Then-vs-now, not a percentage.** Weekly digest (existing cron design) occasionally surfaces
   a juxtaposition — an old one-liner next to a recent one on a related concept — instead of any
   completion stat. "Depth is measured `can I build/explain something I couldn't last month`,"
   per the doc, taken literally as the UI's only comparison mechanism.
3. **The pick itself is the relief.** One card, one action, then a warm specific done-state
   ("added to the order book run — 3 things live now"), never "streak: 4." Reuses the interview
   picker's finite/closeable "today's set" pattern exactly.
4. **Momentum dots as the only "meter."** `topic_state.momentum` (warm/cooling/cold) rendered as
   three small dots, one per track — never a bar, never a percentage, never a number of days.
   Cold is informational only: never red, never sorted to demand attention, never text like "N
   days since." A topic can sit cold indefinitely with zero UI consequence. It exists so the
   *picker* can occasionally deprioritize a stale track — not so the user feels watched.

---

## 5. Optional overflow ("more if there's time")

Strictly opt-in, strictly stateless, never accrues and is never owed:

- After the one daily card is marked done, a single unlabeled **"pull another?"** re-invokes the
  same picker. Not a queue, not a "2/5 bonus" counter — each pull is its own atomic in-the-moment
  yes/no, decided by actual leftover energy.
- No cap is tracked, no after-the-fact tally ("you did 3 today!") is shown — a tally is a streak
  wearing a different font. The Gains Log still logs each rep as its own line; it never
  editorializes about count.
- An overflow pull **never borrows against tomorrow.** Tomorrow's picker has no memory of how
  many pulls happened today. Statelessness here is the actual guardrail, not a UI choice — this
  is the direct answer to "never want a falling-behind indicator": there is nothing to fall
  behind *on*, because nothing is ever counted against a baseline.

---

## 6. Build order

1. `menu_items` migration + one-time seed script from `gains-system.md`'s current bullets.
2. Picker as pure functions (`src/lib/gainsPicker.js`), no DB — mirrors
   `src/lib/interviewPlan.js`'s pattern, fully unit-tested before wiring.
3. `topic_state` + momentum (north-star Part 2, build order item ⑤) — a prerequisite this spec
   inherits rather than duplicates; build it once, both Manager and Gains Feed read it.
4. Wire picker to a single "Gains" card/view: one pull, floor-button escape hatch, done-state,
   optional "pull another?".
5. Gains Log auto-append on completed pull.
6. Then-vs-now surfacing in the existing weekly digest.

Steps 1–2 ship standalone value (a working picker) before touching `topic_state`, so this can
start even if the Manager build slips.

**Status update (2026-07-30): steps 1, 2, and a first cut of 4 are built** —
`menu_items` + starter-menu seeding (in-app button, no service role needed), `gainsPicker.js`
with tests, and `GainsCard.jsx` wired into `FeedView`. Step 4 also picked up two things not in
the original list: literal (non-percentage) progress markers per pick — Dev shows
`section N of M` + takeaways written for that resource, Quant shows a done-count for the current
strand, Interview surfaces the readiness math that already existed but was never shown anywhere
— and hotlinked floor-bypass text (Zetamac links out, the interview floor points at a real
problem URL, Harris stays plain text since no URL exists for it anywhere in the app). Steps 3,
5, 6 are still open.

## 7. Recommended content ("other takes") — scoped, mostly deferred

`GainsCard`'s "other takes" section reuses Feed's existing keyword-relevance ranking
(`feedRelevance.js`'s `sortByRelevance`) rather than anything new — worth being explicit that
this is **not** semantic curation, just word-overlap between feed item titles/summaries and a
term set. As of 2026-07-30 it's pick-aware: the current pick's title is tokenized and folded into
the relevance profile for that render, so a Quant order-book pick nudges toward
market-microstructure feed items instead of always showing the same 3 general-interest items
regardless of what's on the card. This required no schema change — `GainsCard` now takes raw
`feedItems`/`interestProfile` from `FeedView` instead of a precomputed list, and recomputes
relevance itself once the pick loads.

Two heavier pieces from the original north-star Part 5 design were named there but never
captured against this spec specifically — recording them here so they don't get re-discovered
from scratch:

- **Passive boost** — feed ranking reading a `user_model`/`current_focus` signal so items related
  to whatever you're *actually* mid-cursor on (not just your general interest profile) rank
  higher during ordinary Drift-mode browsing, without you having to ask. Needs `topic_state`
  (build order item 3 above) as a prerequisite — same dependency, not extra scope.
- **Active pull** — a "find more like this" action on a topic/pick that fires a scoped search
  (reuses the RAG/agent infra from `2026-06-25-ai-agent-rag-design.md`) and drops candidates into
  that topic's backlog for you to skim, never auto-added. Independent of `topic_state`; could
  ship whenever the agent search infra exists, in either order relative to item 3.

Neither blocks anything already built. Sequence after `topic_state` lands, since passive boost
reuses it directly and active pull benefits from the same context once it exists.

---

## Non-goals (restated for emphasis)

- No pace, target, remaining-count, or behind-indicator for Quant/Dev, ever — see §1.
- No streak, no visible session tally, no "days since" text anywhere in this feature.
- No readiness percentage for Quant/Dev — that math is interview-specific and doesn't transfer;
  forcing it here would misrepresent a fridge as a syllabus.
- Auto-chunking / AI-gathered resources (Deep Topics' Phase B/C) are separate, unstarted work
  this spec doesn't touch.

## Open questions

- Should "floor" pulls also write a Gains Log line, or stay logging-free so the floor never feels
  like it owes a record? (Lean: log it — a floor day is still a rep, and the log's whole point is
  that nothing is too small to count.)
- `menu_items.position` ordering for Strand A (sequential build rungs) vs B/C (non-sequential) —
  same table, different traversal rule. Fine as-is; note it so the picker logic doesn't assume
  uniform ordering.
