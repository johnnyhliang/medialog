# The Manager — scope, and what projects/tasks are NOT

**Date:** 2026-08-07
**Status:** Decided. This document is the authority on the question "should MediaLog
manage tasks and projects", which has now been asked three times and answered
differently each time.
**Supersedes:** `docs/intentional-app-spec.md` Part 1 (reminders as `due_at` entries).
**Reconciles:** `docs/VISION.md` § *What MediaLog Is Not* with
`docs/superpowers/specs/2026-07-04-north-star-experience-design.md` Part 2.
**Absorbs:** `2026-07-17-goals-tracker-design.md`, `docs/interview-progress-spec.md`
(the `studyPlan.js` half), and the Agenda work parked 2026-08-07.

---

## 0. Why this document exists

Two features have already been built and never wired to a UI:

| Module | Lines | Exports used | Written |
|---|---|---|---|
| `src/lib/goals.js` | 84 | **0 of 6** | 2026-07-17 |
| `src/lib/db/studyPlan.js` | 32 | **0 of 2** | 2026-07 |

Both are progress-tracking libraries. Both are tested. Neither is reachable. They
did not fail on implementation — they failed because **the scope was never
written down**, so each one was built, found to be more overhead than it was
worth, and quietly abandoned.

This document is the thing that was missing. It is deliberately as much about
what is *not* being built as what is.

---

## 1. The contradiction, resolved

`docs/VISION.md` § *What MediaLog Is Not*:

> - Not a task manager (TickTick owns that slot)

`docs/intentional-app-spec.md` Part 1:

> **replace a separate todo app** with org-mode-flavored reminders

These have coexisted, unreconciled, since July. The resolution:

**VISION is right about the product. The spec was right about the personal tool.**

- **MediaLog the product does not manage tasks.** No public task feature, no
  todo-app positioning, no competing with TickTick. VISION § *What MediaLog Is
  Not* stands unamended.
- **MediaLog the personal tool gets a founder-only Manager**, on exactly the
  precedent already set in `src/lib/modules.js` for the interview tracker:
  *"personal curriculum, not product surface."*

If it ever ships to users it becomes a free opt-in module, never a paid upsell
and never a headline feature. Same rule as `interview` and `career`.

---

## 2. The central decision: a topic IS the project

There is **no goal object, no project object, and no task table.**

The reasoning, which is the most important paragraph in this document: any task
system worth using needs to know that "Phase 1: order book" belongs to the same
context as your order-book notes. If tasks live in their own hierarchy, you
maintain that mapping by hand forever — which is precisely what makes TickTick
useless here ("it just restructures everything"). Putting the plan *inside* the
topic means **there is nothing to mirror**. One structure. Tasks are checkboxes
in a document.

Concretely, using primitives that already exist:

| Concept | Where it lives | Built? |
|---|---|---|
| The project | a **topic** | ✅ |
| The plan | `topics.master_doc` — markdown, at the top of the topic page | ✅ migration `0007` |
| Tasks / milestones | `- [ ]` checkboxes inside that doc | ✅ (parsing: `goals.js`) |
| Target dates | frontmatter `started:` / `target:` | ✅ (`goals.js`) |
| Progress | derived: steps done vs time elapsed | ✅ (`goals.js`, unused) |
| Reference material | entries in the topic | ✅ |
| Where I left off | topic cursor (today: deep topics) | ⚠️ see §4 |
| State across everything | **the Manager** | ❌ **this is the work** |

`goals.js` stops being dead code without being promoted to a feature: the
Manager reads progress out of `master_doc` using it. No new entity, no new UI
for goals, no migration.

### The UI boundary — decided 2026-08-07, and it is half the decision

**A topic is the project in the DATA. The topic SCREEN does not change.**

These are separate claims and an earlier draft of this section conflated them,
which produced a proposal — one topic screen showing plan chrome for every
topic — that was correctly rejected. Stated plainly:

| Layer | Rule |
|---|---|
| Data | a project is a topic with entries. No projects table, nothing to mirror |
| UI | `TopicView` stays what it is: master doc, entries, notes. **Nothing project-shaped is added to it** |
| Where plans render | **the Manager, and only the Manager** |

A basketball topic must never carry progress bars, phase trackers or cursors it
does not use. `VISION.md` is explicit that complexity is exposed *progressively,
not upfront*, and a topic screen that grows a plan section for all topics
because some are projects is the graveyard pattern applied to UI.

So the Manager is not merely the aggregator — it is the **containment
boundary**. Everything plan-shaped lives on one surface you open deliberately.
That is what keeps "topics are topics" true while still letting a topic be the
home of a project's data.

---

## 3. The Manager

Specified in `2026-07-04-north-star-experience-design.md` Part 2 and unchanged by
this document. Summarised here so this file stands alone.

Per active topic, a machine-maintained resume card:

```
┌─ Systems Design ────────────────────────────────┐
│ last touched 3d ago · 2 active · 5 backlog      │
│ ► You were reading "Designing Data-Intensive…"  │
│   (§4, ~40% through)                            │
│ next: finish ch. 5 notes        [resume] [park] │
└─────────────────────────────────────────────────┘
```

**The upkeep budget is one line per active topic.** This is the constraint that
decides every design question below, because it is the constraint the last two
attempts violated.

- `topic_state`: `topic_id, last_entry_id, last_position, next_action, momentum,
  updated_at`.
- **Everything derives except `next_action`.** `momentum (warm|cooling|cold)`
  and the counts come from timestamps you generate by using the app. You never
  set a priority; the app tells you what is going cold. That cannot be gamed,
  because it measures behaviour rather than intention.
- **`[park]` is the underrated half.** Explicitly shelve a topic with a
  note-to-future-self ("waiting on the course to start"). **Parked ≠ archived.**
  The backburner problem is that everything stays nominally active, so nothing
  feels safe to ignore; parking makes ignoring a decision you made rather than a
  failure you are having.

### Why this addresses "important things drown"

Not by prioritising for you. By three cheaper mechanisms:

1. **Park** removes the ambient guilt of cold topics.
2. **Derived momentum** surfaces what is actually slipping, unprompted.
3. **Sort by momentum × staleness** answers "what's rotting" with no ranking input.

---

## 4. Deep topics are ABSORBED, not deleted

**Correction to an earlier plan in this conversation, recorded because getting
it wrong would have destroyed something.**

`resource_sections` looked like duplicate status tracking (`todo/reading/done`,
a fourth enum for the same idea). It is not only that. `topics.cursor_section_id`
records **where you left off in a long resource**, with takeaways nested per
section. That is the only "where was I" mechanism in the app today, and it is
the prototype of the Manager's resume card — the north-star spec literally draws
it as `► You were reading … §4`.

**Therefore:** collapse the deep-topics *UI* into normal topics + entries as
planned, but **the cursor concept survives and the Manager owns it.** Do not drop
the table until the Manager reads it.

This is the difference between "does anything import this file" and "what does
this actually do", the lesson already recorded in `PROJECT-STATE.md` §2.

---

## 5. Consolidation: the destination is one page

The app has 24 modules, 20 nav items, 26 view branches and 16 settings tabs. Each
feature works; the friction is deciding which surface to open. The north-star
spec diagnosed this in July: *"the current nav is a list of nouns; the daily
experience should be four verbs."*

**The destination is a single Review surface** with internal separation —
inbox sorting, things needing a decision, and an overview of the state of your
documents — rather than three sibling tabs that each answer part of "how am I
doing". The Manager is that page. Consolidation steps are staged toward it, not
performed as arbitrary pairings.

### Staged

| Stage | Change | Confidence |
|---|---|---|
| 1 | ✅ **DONE 2026-08-07. Sort Inbox folded into Tidy**, one surface named **Triage**. Tidy's actions (move/done/snooze/trash/keep) were a strict superset of Sort Inbox's (assign/delete), so widening the queue to all inbox items and deleting `SortInbox.jsx` lost nothing. `useInbox` went with it — `inboxEntries` had become write-only. **Correction to this row as first written:** the badge risk was *not* `inboxEntries`; `inboxCount` comes from `useTopics` as a `count: exact` query and was never exposed. The real risk was the decrement path, which lived only in the deleted handlers — and it must fire on **move and trash only**, because done/snooze leave the row in the Inbox topic and would drift the count low. The `inbox_sorted` activation metric lived there too and would have been silently deleted. | high |
| 2 | **Manager ships**, absorbing the cursor and `[park]`. | — |
| 3 | **Deep-topics UI collapses** into normal topics/entries, cursor retained per §4. **Resequenced 2026-08-07 to come AFTER the Manager**, which is the reverse of the first draft. The collapse's payoff only exists once something renders where-you-are for an ordinary topic; doing it first deletes a working reading UI and leaves a gap until the Manager lands. Afterwards it is a real simplification, because the resume card already shows what `DeepTopicView` was showing. | high |
| 4 | **Digest + Progress reconsidered** — only *after* the Manager exists. Digest is actionable (`onStatusChange`, `onDelete`), Progress is read-only stats; they share a mood, not a shape, so pairing them today is shuffling. Once the Manager owns "state of my world", Digest becomes what the spec already calls it: *"the weekly narrative version of the same data."* | deferred |

---

## 6. The contribution grid

GitHub-style. **A log, not a streak.**

`gains-system.md` is explicit that *"there are no dates and no 'behind'"* and that
the dead-day floor exists so a bad day still counts. A grid matches that; a
"🔥 0 days" counter contradicts it. A streak number may be shown, small, derived
from the same rows — never as the primary reading.

- Schema: `(date, topic_id, kind, note)`. One table. No recurrence rules, no
  completion state, no broken-streak state.
- **A contribution is output, not intake:** a checkbox flipped or an entry marked
  `done`. Saving a link is not a contribution — otherwise the grid measures
  capture volume and can be gamed by pasting URLs, and a dishonest grid is not
  motivating.

---

## 7. Seeding `quantdevplan.xlsx`

The spreadsheet becomes MediaLog data rather than remaining a stray file. Nine
sheets map onto existing primitives; **no new tables beyond §6.**

| Sheet | Becomes |
|---|---|
| Start Here | `master_doc` of a **Quant Dev Plan** topic |
| Timeline | checklist in that master doc (`- [ ] Sep 2026: …`) |
| Project | its own topic; master doc = phased milestones as checkboxes |
| C++ Curriculum | its own topic; master doc = the ordered list |
| Coursework | checklist section in the plan's master doc |
| Sprint (Summer 27) | section in the plan's master doc |
| Weekly Habits | the contribution grid (§6) |
| Applications | **existing `career` module** — already built, not rebuilt |
| Resources | entries in the relevant topics |

Founder account only. Three or four topics total.

### Done 2026-08-07 — `scripts/seed-quant-plan.js`

Landed as written. Three topics, **no new tables and no schema change at all**:

| Topic | Steps | Entries | Window |
|---|---|---|---|
| Quant Dev Plan | 27 (timeline 15 + coursework 8 + sprint 4) | 6 | Aug 2026 → Oct 2027 |
| Order Book (C++) | 6 phases | 3 | Oct 2026 → Jul 2027 |
| C++ Curriculum | 16 | 6 | Aug 2026 → May 2027 |

Plus 14 firms into the existing `applications` table at `status: 'saved'`.

Three decisions worth keeping:

- **`deadline` is left null on every application.** "Applications open ~Aug 2027"
  is a rolling window, and writing it into a date column is exactly the alarm §8
  rules out. It lives in the note.
- **Weekly Habits is a markdown table, not checkboxes.** It is a rhythm, so it
  belongs in the grid (§6) — and as checkboxes it would inflate the progress
  denominator with items that are never "done".
- **The cut coursework (Math 217, Stats 426, EECS 545) is prose, not unchecked
  boxes,** for the same reason: a decision already made must not read as
  outstanding work.

The script is idempotent — topics are matched by name and skipped whole,
applications by `(company, role)` — so re-running adds nothing and overwrites
nothing.

---

## 8. Time model

**Phases with targets. A target is intent, not an alarm.**

- `target:` in frontmatter states what the plan is. Nothing shouts when it slips.
- The only slip signal is `goals.js`'s existing quiet "behind" chip, when steps
  fall >15% behind elapsed time. No notification, no red, no overdue bucket.
- **No per-task due dates.** A task with its own deadline is how a plan becomes a
  nag list.

---

## 9. Explicitly OUT of scope

Recorded so this conversation does not recur.

- **Per-entry due dates as a primary surface.** The Agenda built 2026-08-07 is
  parked, beta-gated. Overdue buckets contradict `gains-system.md` directly.
  `entries.due_at` (`0072`) and `src/lib/timezone.js` (`0073`) are **retained** —
  `target:` dates need the same day-boundary math, and the timezone work is
  independently correct.
- **Calendar events.** `VISION.md` gives that slot to Google Calendar.
- **People / CRM / follow-ups.** A third geometry; including it now is how this
  becomes unbounded again.
- **Recurring tasks, subtasks, notifications, reminders.** Already deferred by
  `2026-07-17-goals-tracker-design.md` § *Out of scope*; still deferred.
- **A separate Goals or Projects view.** §2. The topic is the project.
- **AI deciding what matters.** An agent that ranks your life is wrong often
  enough that you stop trusting it, at which point it is worse than nothing. The
  narrow, reliable use is **drafting `next_action` from recent activity for you
  to accept or edit** — what the north-star spec calls the agent's *"safe-mutation
  tier"*. Suggest, never decide. Last thing built, not first.

---

## 10. Build order

1. This document. ✅
2. Sort Inbox → Tidy, now **Triage**. ✅ 2026-08-07
3. **Manager** — `topic_state`, resume cards, `[park]`, progress read from
   `master_doc` via `goals.js`. **Its own surface** (§2, the UI boundary):
   `TopicView` is not touched by this work.
4. Deep-topics UI collapse, cursor retained (§5 stage 3, §4) — *after* 3, not before
5. Seed `quantdevplan.xlsx` (§7). ✅ 2026-08-07 — `scripts/seed-quant-plan.js`
6. Contribution grid (§6)
7. AI `next_action` drafting (§9, last)

**Step 3 is the one that addresses the stated problem** — things drowning on the
backburner. Park and derived momentum do most of that work. Everything after is
polish; if only 1–3 ever happen, the need is met.

**An open question step 3 does not have to answer.** Whether the book-reading
flow is wanted at all is undecided: there is no deep-topics data, so `reading`
may simply be a feature that was built and never used, in which case step 4 is a
straight deletion of ~280 lines rather than an absorption. Decide after using the
Manager, not before.

Keybinds for fast editing are cheap whenever wanted: `src/lib/commands.js` is
already a registry and every bind is remappable, with a test asserting no
shortcut is hardcoded outside it.
