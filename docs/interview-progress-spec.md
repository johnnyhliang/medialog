# Spec: Progress Markers, Pace & Next-Problem Suggestion

**Written:** 2026-07-29 · **Status:** algorithm built, UI + migration pending

Builds on the interview tracker (patterns = topics with `pattern_target`, problems =
entries). Adds the three things it lacks: a **time dimension**, a **pace**, and a
**decision about what to do next**.

---

## 0. What already exists (verified)

| Piece | Where | State |
|---|---|---|
| `coverage × mastery` readiness | `src/lib/db/interview.js` → `patternReadiness` | ✅ |
| Per-track rollup | `trackReadiness` | ✅ |
| Self-rated `confidence` 1–5 | `entries.confidence` | ✅ |
| SM-2 implementation | `src/lib/db/entries.js` → `sm2`, `rateRevisit` | ✅ |
| SRS columns | `entries.srs_interval / srs_reps / srs_ef` (0036) | ✅ |
| Due date column | `entries.surface_after` | ✅ |

**The disconnect:** `rateRevisit` is wired to the generic Revisit flow. The
interview tracker never calls it, and `listInterview` doesn't even select
`srs_interval` or `surface_after`. So interview problems have full SRS scaffolding
that nothing writes, while `masterySignal` reads `srs_ef` as a fallback — a value
the interview path never updates. Half the feature is already paid for and idle.

**What's genuinely missing:** anything time-aware. `patternReadiness` has no decay,
no notion of "due", and no pace. A pattern solved once in March reads identically to
one solved yesterday.

---

## 1. Progress markers

Three signals, deliberately few — a dashboard of twelve numbers is the
paradox-of-choice problem wearing a lab coat.

**① Readiness ring per pattern** — `coverage × mastery`, already computed. Render as
a ring on the pattern card, not a number. Rings compare at a glance; percentages
invite arithmetic.

**② Staleness** — new. A pattern where every solved problem is overdue for review is
not "ready," however good its mastery was. Defined as the fraction of solved
problems whose `surface_after` has passed. Surfaces as a dot on the ring, not a
second ring.

**③ Track readiness bar** — `trackReadiness`, already computed, one bar per track
(SWE, sysdesign, qt, quant-dev, apm). This is the "am I interviewable" number.

**Explicitly not built:** streaks. A streak punishes a deliberate rest day and
converts a learning tool into a Duolingo guilt engine. Cadence is measured for
*pace* (below) but never displayed as an unbroken chain.

---

## 2. Pace

The one place a new column is needed: a target date.

```sql
alter table user_configs add column if not exists prep_target_date date;
```

Everything else derives:

- **remaining** = Σ over patterns of `max(0, target − solved)`
- **weeksLeft** = `(prep_target_date − today) / 7`, floored at a partial week
- **requiredRate** = `remaining / weeksLeft` problems per week
- **actualRate** = problems moved to `done` in the last 14 days ÷ 2, using entry
  timestamps (no new tracking; `entry_created`/status changes already exist)
- **verdict** = `ahead` | `on_pace` | `behind` | `no_target`

Report as *"4/week to be ready by Sep 12; you're doing 6"*. A rate is actionable in
a way a percentage never is: it converts directly into a decision about today.

`no_target` is a first-class state, not an error. Pace is opt-in; without a date the
tracker still works and simply doesn't nag.

---

## 3. Next-problem suggestion

The core. A scoring pass over candidates, in strict precedence:

**Tier 1 — due reviews win.** Any solved problem with `surface_after` in the past
outranks every unsolved problem. Retention beats volume: re-deriving a pattern you
already solved is worth more than a first pass at a new one, and it's the whole
reason SM-2 is in the schema. Cap at 3 per session so reviews can't crowd out
progress entirely.

**Tier 2 — weakest pattern, easiest unsolved problem.** Among unsolved problems,
score the *pattern* and pick within it:

```
patternNeed = (1 − readiness) × trackWeight × recencyPenalty
```

- `trackWeight` — patterns on a track you've prioritized count more
- `recencyPenalty` — down-weight a pattern touched today, so a session spreads
  rather than tunnelling into one topic

Within the chosen pattern, take the **easiest unsolved** problem (`easy` →
`medium` → `hard`). Difficulty is a ladder, not a filter: dropping someone into a
hard problem in a pattern they've barely covered teaches helplessness, not the
pattern.

**Anti-tunnelling gates**, applied after scoring:
- No more than 2 consecutive suggestions from the same pattern
- Never suggest from a pattern already at `coverage ≥ 1` unless it has due reviews
- The daily set is **finite and closeable** — default 5. When it's done, the UI says
  *you're caught up*, matching the Today-screen philosophy in
  `docs/intentional-app-spec.md` Part 3. An infinite queue is the thing being
  designed against.

---

## 4. Build order

1. ✅ `src/lib/interviewPlan.js` — pure functions, no DB, fully unit-tested
2. Wire `rateRevisit` into the interview flow so `surface_after` actually gets
   written (**this is the highest-value single change** — it activates the idle SRS
   scaffolding), and add `srs_interval, surface_after` to `listInterview`'s select
3. `prep_target_date` migration + a date field in Settings
4. UI: readiness rings + staleness dot, track bars, a "today's set" panel with the
   caught-up state

Step 2 before step 4. Rings over data nothing updates would be theatre.

---

## 5. Open question

`masterySignal` trusts self-rated `confidence` over SM-2 ease. That's right for a
first pass — you know whether you actually understood it — but self-ratings drift
optimistic over time, and SM-2 ease is empirical. Once real review history exists,
consider blending: `confidence` decaying in influence as `srs_reps` grows.
