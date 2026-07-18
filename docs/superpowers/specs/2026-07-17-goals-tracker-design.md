# Goals — Life Tracker v1 (Design Spec)

**Date:** 2026-07-17
**Status:** Approved, ready for planning
**Build order:** Feature A of A→B→C→D1→D2 (see companion specs)

## Purpose

Turn goals into step-by-step lists with two derived progress bars (steps done,
time elapsed) rendered as cards. Must stay markdown-native so goals export/import
as plain files like everything else. No new data format — a goal **is an entry**.

## Data model

A goal is an ordinary `entries` row inside an auto-created **Goals** topic.

- `topics.kind = 'goals'` — a single Goals topic per user, get-or-created the
  first time `GoalsView` mounts. No signup trigger, no new table. Reuses the
  `kind` column already added in migration 0042.
- `entries.title` — the goal name.
- `entries.status` — reuses existing `backlog | active | done`:
  - `active` → "Active"
  - `backlog` → "Someday"
  - `done` → "Done"
- `entries.note` — markdown body holding dates (frontmatter) + steps (task list):

```markdown
---
started: 2026-07-16
target: 2026-10-01
---
Why this matters, links, freeform notes…

- [x] RLS audit
- [ ] Landing copy pass
- [ ] YC application draft
```

No migration is strictly required beyond ensuring `topics.kind` accepts
`'goals'` (0042 already made `kind` a free-text column with default `'note'`, so
no schema change is needed).

## Parsing — `src/lib/goals.js`

Pure, dependency-free, fully unit-tested. No YAML library.

- `parseFrontmatter(note)` → `{ started?: Date, target?: Date, body: string }`.
  Reads only a leading `---\n…\n---` block, splits `key: value` lines, parses
  `started`/`target` as ISO dates. Anything else in frontmatter is ignored, not
  an error. Malformed/absent block → `{ body: note }`.
- `parseSteps(body)` → `{ total, done, steps: [{ text, checked, lineIndex }] }`
  via regex on `^\s*- \[( |x|X)\]` lines.
- `deriveProgress({ started, target, total, done, now })` →
  - `stepPct = total ? done/total : null`
  - `timePct = (started && target) ? clamp((now-started)/(target-started), 0, 1) : null`
  - `daysLeft = target ? ceil((target-now)/day) : null`
  - `onTrack` — `false` (behind) when `timePct - stepPct > 0.15`, else `true`;
    `null` when either pct is null.

Degrade gracefully: missing dates → steps bar only; no checkboxes → time bar
only; both missing → card shows title + status only. Never throws.

## Mutation

- `toggleStep(note, lineIndex)` — pure text transform flipping `- [ ]`↔`- [x]`
  on the given line; returns new note string. Used by the card's "complete up
  next" button and (later) live-preview checkbox clicks.
- `newGoalTemplate()` — returns note with `started` = today, `target` = +30 days,
  empty body, one empty step. Used by "New goal".

## UI — `src/components/GoalsView.jsx`

Card grid reusing existing card + theme tokens (match `EntryCard` /
`TopicsGrid` structure and class names; no new design tokens).

- Groups: **Active** (open) · **Someday** (open) · **Done** (collapsed).
- Card contents:
  - Title
  - Steps bar with `done/total` label
  - Time bar with `days left` label; muted "behind" chip when `onTrack === false`
  - "Up next: {first unchecked step text}" + a check button that calls
    `toggleStep` and persists the entry.
  - Click card body → opens the entry in the existing NoteEditor.
- **New goal** button → creates entry from `newGoalTemplate()` in the Goals topic,
  opens it in the editor.

## Navigation + home widget

- `NavSidebar` daily section: add `{ view: 'goals', label: 'Goals', icon: Target }`
  (lucide `Target`), placed after `interview`.
- Home widget (`src/components/widgets/`): "Goals" panel showing up to 3 active
  goals nearest their `target`, each a compact row (title, mini steps bar, days
  left). Reuses `WidgetPanel`. Clicking a row navigates to `goals`.

## Export / import

No work required. Goals are entries; the existing export already serializes them.
The frontmatter + task list make each file self-describing in any markdown tool.

## Testing

- `goals.test.js` — frontmatter parsing (present/absent/malformed), step
  counting, `deriveProgress` edge cases (missing dates, 0 steps, clamping,
  on-track boundary at exactly 0.15), `toggleStep` idempotency and line
  targeting, `newGoalTemplate` shape.
- `GoalsView.test.jsx` — grouping by status, bar rendering with mocked entries,
  "complete up next" flips the right step and persists, empty state.

## Out of scope (deferred)

Habits/streaks/check-in logs, nested sub-goals with rollup, reminders/notifications.
Documented here so v1 stays a clean deadline-goal tracker.
