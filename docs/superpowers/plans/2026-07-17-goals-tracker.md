# Goals — Life Tracker v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Goals view where each goal is an entry with YAML-ish frontmatter (start/target dates) and a checkbox task list, rendered as cards with two derived progress bars (steps done, time elapsed), plus a home widget for active goals nearest their deadline.

**Architecture:** A goal is an ordinary `entries` row inside a single auto-created "Goals" topic (`topics.kind = 'goals'`). All goal metadata lives in the markdown `note` (frontmatter dates + task-list steps), so nothing new is stored and export/import stays plain markdown. A pure, dependency-free parsing module (`src/lib/goals.js`) derives progress; a self-contained `GoalsView` component loads/creates/edits goals via existing `entries`/`topics` db helpers; a `GoalsWidget` surfaces the nearest-deadline active goals on Home.

**Tech Stack:** React 18, Vite, Vitest + @testing-library/react, Supabase JS client (mocked in tests via `src/test/mockSupabase.js`), lucide-react icons, CodeMirror via the existing lazy `NoteEditor`.

## Global Constraints

- **No new dependencies.** Frontmatter parsing is hand-rolled; no YAML library.
- **No schema migration.** `topics.kind` is already a free-text column (default `'note'`, added in migration 0042). Goals use `kind = 'goals'`.
- **Reuse existing db helpers** in `src/lib/db/entries.js` and `src/lib/db/topics.js`; do not write raw Supabase queries in components except where a new helper is added to those files.
- **Reuse existing CSS tokens / class names** from `src/styles.css` (card, pill, progress classes). Add new classes only with the `goal-` prefix; do not introduce a new design system.
- **No `Co-Authored-By` trailers** in commits (repo convention).
- **Test command:** `npm test` (`vitest run`). Every task ends green.
- `goals.js` functions must never throw on malformed input — degrade gracefully.

---

## File Structure

- Create: `src/lib/goals.js` — pure parse/derive/mutate functions (no React, no Supabase).
- Create: `src/lib/goals.test.js` — unit tests for the above.
- Create: `src/lib/db/goals.js` — Supabase helpers: get-or-create the Goals topic, list goal entries, create a goal.
- Create: `src/lib/db/goals.test.js` — unit tests for the db helpers (mocked Supabase).
- Create: `src/components/GoalCard.jsx` — one goal card (bars, up-next, inline editor).
- Create: `src/components/GoalCard.test.jsx` — card rendering/interaction tests.
- Create: `src/components/GoalsView.jsx` — loads goals, groups by status, "New goal".
- Create: `src/components/GoalsView.test.jsx` — grouping + new-goal tests.
- Create: `src/components/widgets/GoalsWidget.jsx` — Home widget, top 3 active goals by nearest target.
- Create: `src/components/widgets/GoalsWidget.test.jsx` — widget tests.
- Modify: `src/components/NavSidebar.jsx` — add the `goals` nav item + `Target` icon import.
- Modify: `src/components/WidgetPanel.jsx` — mount `GoalsWidget`.
- Modify: `src/App.jsx` — route `view === 'goals'` to `GoalsView`; pass navigation to the widget.
- Modify: `src/styles.css` — `goal-` prefixed classes (bars, card layout).

---

## Task 1: Pure goals parsing module (`src/lib/goals.js`)

**Files:**
- Create: `src/lib/goals.js`
- Test: `src/lib/goals.test.js`

**Interfaces:**
- Consumes: nothing (pure JS).
- Produces:
  - `parseFrontmatter(note: string) => { started: Date | null, target: Date | null, body: string }`
  - `parseSteps(body: string) => { total: number, done: number, steps: Array<{ text: string, checked: boolean, lineIndex: number }> }`
  - `deriveProgress({ started, target, total, done, now }) => { stepPct: number | null, timePct: number | null, daysLeft: number | null, onTrack: boolean | null }`
  - `toggleStep(note: string, lineIndex: number) => string`
  - `newGoalTemplate(now?: Date) => string`
  - `parseGoal(note: string, now?: Date) => { started, target, body, total, done, steps, stepPct, timePct, daysLeft, onTrack }` (convenience combining the above)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/goals.test.js`:

```js
import { describe, test, expect } from 'vitest'
import {
  parseFrontmatter, parseSteps, deriveProgress,
  toggleStep, newGoalTemplate, parseGoal,
} from './goals.js'

const NOTE = `---
started: 2026-07-01
target: 2026-07-31
---
Ship it.

- [x] one
- [ ] two
- [X] three
`

describe('parseFrontmatter', () => {
  test('reads started/target and returns body without the block', () => {
    const { started, target, body } = parseFrontmatter(NOTE)
    expect(started).toEqual(new Date('2026-07-01'))
    expect(target).toEqual(new Date('2026-07-31'))
    expect(body).toContain('- [x] one')
    expect(body).not.toContain('---')
  })

  test('no frontmatter returns nulls and original body', () => {
    const { started, target, body } = parseFrontmatter('just text\n- [ ] a')
    expect(started).toBeNull()
    expect(target).toBeNull()
    expect(body).toBe('just text\n- [ ] a')
  })

  test('malformed dates become null, never throws', () => {
    const { started, target } = parseFrontmatter('---\nstarted: notadate\n---\nx')
    expect(started).toBeNull()
    expect(target).toBeNull()
  })
})

describe('parseSteps', () => {
  test('counts checked and unchecked, case-insensitive', () => {
    const { total, done, steps } = parseSteps(NOTE)
    expect(total).toBe(3)
    expect(done).toBe(2)
    expect(steps[0]).toMatchObject({ text: 'one', checked: true })
    expect(steps[1]).toMatchObject({ text: 'two', checked: false })
  })

  test('records the source line index of each step', () => {
    const { steps } = parseSteps('a\n- [ ] first\nb\n- [x] second')
    expect(steps[0].lineIndex).toBe(1)
    expect(steps[1].lineIndex).toBe(3)
  })

  test('no steps returns total 0', () => {
    expect(parseSteps('no tasks here').total).toBe(0)
  })
})

describe('deriveProgress', () => {
  const started = new Date('2026-07-01')
  const target = new Date('2026-07-31')

  test('stepPct is done/total', () => {
    const { stepPct } = deriveProgress({ started, target, total: 4, done: 1, now: started })
    expect(stepPct).toBeCloseTo(0.25)
  })

  test('timePct clamps to [0,1] and daysLeft counts down', () => {
    const now = new Date('2026-07-16') // halfway
    const { timePct, daysLeft } = deriveProgress({ started, target, total: 2, done: 1, now })
    expect(timePct).toBeCloseTo(0.5, 1)
    expect(daysLeft).toBe(15)
  })

  test('past target clamps timePct to 1 and daysLeft can go negative', () => {
    const now = new Date('2026-08-10')
    const { timePct, daysLeft } = deriveProgress({ started, target, total: 2, done: 0, now })
    expect(timePct).toBe(1)
    expect(daysLeft).toBeLessThan(0)
  })

  test('missing dates yield null time fields but keep stepPct', () => {
    const { stepPct, timePct, daysLeft, onTrack } = deriveProgress({ started: null, target: null, total: 2, done: 1, now: started })
    expect(stepPct).toBe(0.5)
    expect(timePct).toBeNull()
    expect(daysLeft).toBeNull()
    expect(onTrack).toBeNull()
  })

  test('no steps yields null stepPct', () => {
    expect(deriveProgress({ started, target, total: 0, done: 0, now: started }).stepPct).toBeNull()
  })

  test('behind when time leads steps by more than 0.15', () => {
    const now = new Date('2026-07-25') // ~0.8 time
    const { onTrack } = deriveProgress({ started, target, total: 10, done: 1, now })
    expect(onTrack).toBe(false)
  })

  test('on track at exactly 0.15 gap', () => {
    // time 0.5, steps 0.35 -> gap exactly 0.15 -> onTrack true (strict >)
    const now = new Date('2026-07-16')
    const { onTrack } = deriveProgress({ started, target, total: 100, done: 35, now })
    expect(onTrack).toBe(true)
  })
})

describe('toggleStep', () => {
  test('flips the checkbox on the given line only', () => {
    const out = toggleStep(NOTE, 6) // line index of "- [x] one" in NOTE
    const line = out.split('\n')[6]
    expect(line).toBe('- [ ] one')
  })

  test('unknown line index returns note unchanged', () => {
    expect(toggleStep(NOTE, 999)).toBe(NOTE)
  })
})

describe('newGoalTemplate', () => {
  test('has today as started and +30 days as target', () => {
    const now = new Date('2026-07-17')
    const tpl = newGoalTemplate(now)
    expect(tpl).toContain('started: 2026-07-17')
    expect(tpl).toContain('target: 2026-08-16')
    expect(tpl).toMatch(/- \[ \]/)
  })
})

describe('parseGoal', () => {
  test('combines frontmatter, steps, and derived progress', () => {
    const g = parseGoal(NOTE, new Date('2026-07-16'))
    expect(g.total).toBe(3)
    expect(g.done).toBe(2)
    expect(g.stepPct).toBeCloseTo(2 / 3)
    expect(g.timePct).toBeCloseTo(0.5, 1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/goals.test.js`
Expected: FAIL — `Failed to resolve import "./goals.js"` / functions not defined.

- [ ] **Step 3: Implement `src/lib/goals.js`**

```js
// Goals are entries whose markdown note carries dates (frontmatter) + steps
// (task list). Everything here is pure and never throws on bad input.

const DAY = 86400000
const BEHIND_GAP = 0.15

function parseDate(value) {
  if (!value) return null
  const d = new Date(value.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

export function parseFrontmatter(note) {
  const src = String(note ?? '')
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(src)
  if (!match) return { started: null, target: null, body: src }
  const fields = {}
  for (const line of match[1].split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line)
    if (m) fields[m[1]] = m[2]
  }
  return {
    started: parseDate(fields.started),
    target: parseDate(fields.target),
    body: src.slice(match[0].length),
  }
}

export function parseSteps(body) {
  const lines = String(body ?? '').split('\n')
  const steps = []
  lines.forEach((line, lineIndex) => {
    const m = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/.exec(line)
    if (m) steps.push({ text: m[2].trim(), checked: m[1].toLowerCase() === 'x', lineIndex })
  })
  const done = steps.filter((s) => s.checked).length
  return { total: steps.length, done, steps }
}

export function deriveProgress({ started, target, total, done, now = new Date() }) {
  const stepPct = total > 0 ? done / total : null
  let timePct = null
  let daysLeft = null
  if (started && target && target > started) {
    const raw = (now - started) / (target - started)
    timePct = Math.min(1, Math.max(0, raw))
    daysLeft = Math.ceil((target - now) / DAY)
  } else if (target) {
    daysLeft = Math.ceil((target - now) / DAY)
  }
  let onTrack = null
  if (stepPct !== null && timePct !== null) {
    onTrack = timePct - stepPct <= BEHIND_GAP
  }
  return { stepPct, timePct, daysLeft, onTrack }
}

export function toggleStep(note, lineIndex) {
  const lines = String(note ?? '').split('\n')
  if (lineIndex < 0 || lineIndex >= lines.length) return note
  const flipped = lines[lineIndex].replace(/\[( |x|X)\]/, (m, c) =>
    c === ' ' ? '[x]' : '[ ]',
  )
  if (flipped === lines[lineIndex]) return note
  lines[lineIndex] = flipped
  return lines.join('\n')
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export function newGoalTemplate(now = new Date()) {
  const target = new Date(now.getTime() + 30 * DAY)
  return `---\nstarted: ${isoDate(now)}\ntarget: ${isoDate(target)}\n---\n\n- [ ] First step\n`
}

export function parseGoal(note, now = new Date()) {
  const { started, target, body } = parseFrontmatter(note)
  const { total, done, steps } = parseSteps(body)
  const progress = deriveProgress({ started, target, total, done, now })
  return { started, target, body, total, done, steps, ...progress }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/goals.test.js`
Expected: PASS (all cases). If the `toggleStep` line index (6) mismatches, count the lines in `NOTE` and adjust the test's expected index — do not change production behavior.

- [ ] **Step 5: Commit**

```bash
git add src/lib/goals.js src/lib/goals.test.js
git commit -m "feat: pure goals parsing + progress derivation module"
```

---

## Task 2: Goals db helpers (`src/lib/db/goals.js`)

**Files:**
- Create: `src/lib/db/goals.js`
- Test: `src/lib/db/goals.test.js`

**Interfaces:**
- Consumes: `mockSupabase` in tests; the real `supabase` client at runtime. `createEntry`/`updateEntry` from `src/lib/db/entries.js` are available but goals create their own topic here.
- Produces:
  - `getOrCreateGoalsTopic(supabase) => Promise<{ id, name, kind }>` — finds the user's `kind='goals'` topic or creates one named "Goals".
  - `listGoals(supabase, topicId) => Promise<Array<entry>>` — entries in the goals topic, not deleted, newest first.
  - `createGoal(supabase, { topicId, title, note }) => Promise<entry>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/db/goals.test.js`:

```js
import { describe, test, expect } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase.js'
import { getOrCreateGoalsTopic, listGoals, createGoal } from './goals.js'

function withUser(result) {
  const sb = mockSupabase(result)
  sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
  return sb
}

describe('getOrCreateGoalsTopic', () => {
  test('returns the existing goals topic when one is found', async () => {
    const sb = withUser({ data: { id: 't-goals', name: 'Goals', kind: 'goals' }, error: null })
    const out = await getOrCreateGoalsTopic(sb)
    expect(sb.from).toHaveBeenCalledWith('topics')
    expect(sb._chain.eq).toHaveBeenCalledWith('kind', 'goals')
    expect(out).toMatchObject({ id: 't-goals', kind: 'goals' })
  })

  test('creates a Goals topic when none exists', async () => {
    // maybeSingle resolves null (not found); insert path returns the new row.
    const sb = withUser({ data: null, error: null })
    sb._chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
    sb._chain.single = () => Promise.resolve({ data: { id: 't-new', name: 'Goals', kind: 'goals' }, error: null })
    const out = await getOrCreateGoalsTopic(sb)
    expect(sb._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', name: 'Goals', kind: 'goals' }),
    )
    expect(out).toMatchObject({ id: 't-new' })
  })
})

describe('listGoals', () => {
  test('queries the goals topic, excludes deleted, newest first', async () => {
    const sb = mockSupabase({ data: [{ id: 'g1', note: '' }], error: null })
    const out = await listGoals(sb, 't-goals')
    expect(sb.from).toHaveBeenCalledWith('entries')
    expect(sb._chain.eq).toHaveBeenCalledWith('topic_id', 't-goals')
    expect(sb._chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(out).toHaveLength(1)
  })
})

describe('createGoal', () => {
  test('inserts an entry in the goals topic', async () => {
    const sb = mockSupabase({ data: { id: 'g-new', title: 'Ship v1' }, error: null })
    const out = await createGoal(sb, { topicId: 't-goals', title: 'Ship v1', note: '---\n---\n' })
    expect(sb.from).toHaveBeenCalledWith('entries')
    expect(sb._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ topic_id: 't-goals', title: 'Ship v1' }),
    )
    expect(out).toMatchObject({ id: 'g-new' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/db/goals.test.js`
Expected: FAIL — `Failed to resolve import "./goals.js"`.

- [ ] **Step 3: Implement `src/lib/db/goals.js`**

```js
// Goals live in a single per-user topic (kind='goals'). Each goal is an entry
// whose note holds frontmatter dates + a task list. Mirrors the deepTopics
// helper style: auth.getUser for user_id, throw on error.

const MAX_NOTE = 10000

export async function getOrCreateGoalsTopic(supabase) {
  const { data: existing, error } = await supabase
    .from('topics')
    .select('*')
    .eq('kind', 'goals')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) return existing

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error: insErr } = await supabase
    .from('topics')
    .insert({ user_id: user.id, name: 'Goals', kind: 'goals' })
    .select()
    .single()
  if (insErr) throw new Error(insErr.message)
  return data
}

export async function listGoals(supabase, topicId) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('topic_id', topicId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createGoal(supabase, { topicId, title, note }) {
  const { data, error } = await supabase
    .from('entries')
    .insert({ topic_id: topicId, title: String(title).slice(0, 300), note: String(note ?? '').slice(0, MAX_NOTE) })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```

Note: updating a goal's note and status reuses `updateEntry` and the existing status-change handler from `src/lib/db/entries.js`; no new helper needed for those.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/db/goals.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/goals.js src/lib/db/goals.test.js
git commit -m "feat: goals db helpers (get-or-create topic, list, create)"
```

---

## Task 3: Goal card component (`src/components/GoalCard.jsx`)

**Files:**
- Create: `src/components/GoalCard.jsx`
- Test: `src/components/GoalCard.test.jsx`
- Modify: `src/styles.css` (append `goal-` classes)

**Interfaces:**
- Consumes: `parseGoal`, `toggleStep` from `src/lib/goals.js`.
- Props: `GoalCard({ goal, onNoteSave, onStatusChange, onOpen })`
  - `goal` — an entry row (`{ id, title, note, status }`).
  - `onNoteSave(id, note)` — persist an edited note (used by the up-next check button).
  - `onStatusChange(id, status)` — change status via the select.
  - `onOpen(goal)` — open the goal for full editing (card body click).
- Produces: a card element with `data-testid="goal-card"`, two progress bars, up-next row.

- [ ] **Step 1: Write the failing tests**

Create `src/components/GoalCard.test.jsx`:

```jsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GoalCard from './GoalCard.jsx'

const NOTE = `---
started: 2026-07-01
target: 2026-07-31
---
- [x] one
- [ ] two
- [ ] three
`

const goal = { id: 'g1', title: 'Ship v1', note: NOTE, status: 'active' }

describe('GoalCard', () => {
  test('renders the title and a steps count', () => {
    render(<GoalCard goal={goal} onNoteSave={vi.fn()} onStatusChange={vi.fn()} onOpen={vi.fn()} />)
    expect(screen.getByText('Ship v1')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  test('shows the first unchecked step as up-next', () => {
    render(<GoalCard goal={goal} onNoteSave={vi.fn()} onStatusChange={vi.fn()} onOpen={vi.fn()} />)
    expect(screen.getByText(/two/)).toBeInTheDocument()
  })

  test('completing up-next flips the correct step and saves', () => {
    const onNoteSave = vi.fn()
    render(<GoalCard goal={goal} onNoteSave={onNoteSave} onStatusChange={vi.fn()} onOpen={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('complete up next'))
    expect(onNoteSave).toHaveBeenCalledTimes(1)
    const [, savedNote] = onNoteSave.mock.calls[0]
    expect(savedNote).toContain('- [x] two')
  })

  test('clicking the card body opens the goal', () => {
    const onOpen = vi.fn()
    render(<GoalCard goal={goal} onNoteSave={vi.fn()} onStatusChange={vi.fn()} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('Ship v1'))
    expect(onOpen).toHaveBeenCalledWith(goal)
  })

  test('a goal with no steps still renders (time bar only)', () => {
    const g = { id: 'g2', title: 'Read daily', note: '---\nstarted: 2026-07-01\ntarget: 2026-08-01\n---\nnotes', status: 'active' }
    render(<GoalCard goal={g} onNoteSave={vi.fn()} onStatusChange={vi.fn()} onOpen={vi.fn()} />)
    expect(screen.getByText('Read daily')).toBeInTheDocument()
    expect(screen.queryByLabelText('complete up next')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/GoalCard.test.jsx`
Expected: FAIL — cannot resolve `./GoalCard.jsx`.

- [ ] **Step 3: Implement `src/components/GoalCard.jsx`**

```jsx
import { CheckCircle2, Circle } from 'lucide-react'
import { parseGoal, toggleStep } from '../lib/goals.js'

const STATUSES = ['backlog', 'active', 'done']
const STATUS_LABEL = { backlog: 'Someday', active: 'Active', done: 'Done' }

function pct(n) {
  return n === null ? 0 : Math.round(n * 100)
}

export default function GoalCard({ goal, onNoteSave, onStatusChange, onOpen }) {
  const g = parseGoal(goal.note || '')
  const upNext = g.steps.find((s) => !s.checked) || null

  function completeUpNext(e) {
    e.stopPropagation()
    if (!upNext) return
    onNoteSave(goal.id, toggleStep(goal.note || '', upNext.lineIndex))
  }

  function handleStatus(e) {
    e.stopPropagation()
    onStatusChange(goal.id, e.target.value)
  }

  return (
    <div
      className="card goal-card"
      data-testid="goal-card"
      onClick={(e) => { if (!e.target.closest('button, select')) onOpen(goal) }}
    >
      <div className="goal-card-head">
        <span className="card-title">{goal.title}</span>
        <select className="status-select" value={goal.status || 'active'} onChange={handleStatus}>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {g.stepPct !== null && (
        <div className="goal-bar-row">
          <div className="goal-bar">
            <div className="goal-bar-fill goal-bar-steps" style={{ width: `${pct(g.stepPct)}%` }} />
          </div>
          <span className="goal-bar-label">{g.done}/{g.total}</span>
        </div>
      )}

      {g.timePct !== null && (
        <div className="goal-bar-row">
          <div className="goal-bar">
            <div className="goal-bar-fill goal-bar-time" style={{ width: `${pct(g.timePct)}%` }} />
          </div>
          <span className="goal-bar-label">
            {g.daysLeft >= 0 ? `${g.daysLeft}d left` : `${-g.daysLeft}d over`}
          </span>
        </div>
      )}

      {g.onTrack === false && <span className="goal-behind-chip">behind</span>}

      {upNext && (
        <div className="goal-upnext">
          <button className="icon-btn" aria-label="complete up next" onClick={completeUpNext}>
            <Circle size={15} />
          </button>
          <span className="goal-upnext-text">{upNext.text}</span>
        </div>
      )}

      {g.total > 0 && g.done === g.total && (
        <div className="goal-upnext goal-upnext--done">
          <CheckCircle2 size={15} /> <span>All steps done</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Append styles to `src/styles.css`**

Add at the end of the file:

```css
/* Goals */
.goal-card { display: flex; flex-direction: column; gap: 8px; cursor: pointer; }
.goal-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.goal-bar-row { display: flex; align-items: center; gap: 8px; }
.goal-bar { flex: 1; height: 6px; border-radius: 4px; background: var(--border, #e5e5e5); overflow: hidden; }
.goal-bar-fill { height: 100%; border-radius: 4px; }
.goal-bar-steps { background: var(--active, #4a90d9); }
.goal-bar-time { background: var(--backlog, #b0b0b0); }
.goal-bar-label { font-size: 12px; color: var(--text-muted, #888); min-width: 48px; text-align: right; }
.goal-behind-chip { align-self: flex-start; font-size: 11px; padding: 1px 6px; border-radius: 4px; background: var(--danger-bg, #fbe9e7); color: var(--danger, #c0392b); }
.goal-upnext { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.goal-upnext-text { color: var(--text, #333); }
.goal-upnext--done { color: var(--done, #4a9d5b); }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/components/GoalCard.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/GoalCard.jsx src/components/GoalCard.test.jsx src/styles.css
git commit -m "feat: goal card with derived progress bars and up-next"
```

---

## Task 4: Goals view (`src/components/GoalsView.jsx`)

**Files:**
- Create: `src/components/GoalsView.jsx`
- Test: `src/components/GoalsView.test.jsx`

**Interfaces:**
- Consumes: `getOrCreateGoalsTopic`, `listGoals`, `createGoal` from `src/lib/db/goals.js`; `updateEntry` from `src/lib/db/entries.js`; `newGoalTemplate` from `src/lib/goals.js`; `GoalCard`; lazy `NoteEditor`.
- Props: `GoalsView({ supabase, addToast })` — self-loading, like `InterviewView`.
- Produces: renders grouped goal cards (Active / Someday / Done) with a "New goal" button; opening a goal shows an inline `NoteEditor` that persists via `updateEntry`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/GoalsView.test.jsx`:

```jsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import GoalsView from './GoalsView.jsx'

const goals = [
  { id: 'a', title: 'Active goal', note: '---\nstarted: 2026-07-01\ntarget: 2026-08-01\n---\n- [ ] x', status: 'active' },
  { id: 's', title: 'Someday goal', note: '', status: 'backlog' },
  { id: 'd', title: 'Done goal', note: '', status: 'done' },
]

vi.mock('../lib/db/goals.js', () => ({
  getOrCreateGoalsTopic: vi.fn(async () => ({ id: 't-goals', kind: 'goals' })),
  listGoals: vi.fn(async () => goals),
  createGoal: vi.fn(async () => ({ id: 'new', title: 'Untitled goal', note: '', status: 'active' })),
}))
vi.mock('../lib/db/entries.js', () => ({ updateEntry: vi.fn(async () => ({})) }))

describe('GoalsView', () => {
  beforeEach(() => vi.clearAllMocks())

  test('loads and groups goals by status', async () => {
    render(<GoalsView supabase={{}} addToast={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Active goal')).toBeInTheDocument())
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Someday')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  test('New goal creates a goal and reloads', async () => {
    const { createGoal, listGoals } = await import('../lib/db/goals.js')
    render(<GoalsView supabase={{}} addToast={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Active goal')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /new goal/i }))
    await waitFor(() => expect(createGoal).toHaveBeenCalled())
    expect(listGoals).toHaveBeenCalledTimes(2) // initial + after create
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/GoalsView.test.jsx`
Expected: FAIL — cannot resolve `./GoalsView.jsx`.

- [ ] **Step 3: Implement `src/components/GoalsView.jsx`**

```jsx
import { lazy, Suspense, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import GoalCard from './GoalCard.jsx'
import { getOrCreateGoalsTopic, listGoals, createGoal } from '../lib/db/goals.js'
import { updateEntry } from '../lib/db/entries.js'
import { newGoalTemplate } from '../lib/goals.js'

const NoteEditor = lazy(() => import('./NoteEditor.jsx'))

const GROUPS = [
  { key: 'active', label: 'Active', match: (s) => s === 'active' || !s },
  { key: 'backlog', label: 'Someday', match: (s) => s === 'backlog' },
  { key: 'done', label: 'Done', match: (s) => s === 'done', collapsed: true },
]

export default function GoalsView({ supabase, addToast }) {
  const [topicId, setTopicId] = useState(null)
  const [goals, setGoals] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [draft, setDraft] = useState('')

  async function reload(tid) {
    setGoals(await listGoals(supabase, tid))
  }

  useEffect(() => {
    let alive = true
    getOrCreateGoalsTopic(supabase)
      .then(async (topic) => {
        if (!alive) return
        setTopicId(topic.id)
        setGoals(await listGoals(supabase, topic.id))
      })
      .catch((e) => addToast?.(e.message, 'error'))
    return () => { alive = false }
  }, [supabase])

  async function handleNew() {
    const created = await createGoal(supabase, {
      topicId, title: 'Untitled goal', note: newGoalTemplate(),
    })
    await reload(topicId)
    setOpenId(created.id)
    setDraft(created.note)
  }

  async function handleNoteSave(id, note) {
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, note } : g)))
    await updateEntry(supabase, id, { note })
  }

  async function handleStatus(id, status) {
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, status } : g)))
    await updateEntry(supabase, id, { status })
  }

  async function closeEditor() {
    if (openId) await updateEntry(supabase, openId, { note: draft })
    setGoals((gs) => gs.map((g) => (g.id === openId ? { ...g, note: draft } : g)))
    setOpenId(null)
  }

  if (goals === null) return <p className="muted">Loading goals…</p>

  return (
    <div className="goals-view">
      <div className="goals-view-head">
        <h2>Goals</h2>
        <button className="btn-small" onClick={handleNew}><Plus size={14} /> New goal</button>
      </div>

      {goals.length === 0 && <p className="muted">No goals yet. Create one to start tracking.</p>}

      {GROUPS.map((group) => {
        const rows = goals.filter((g) => group.match(g.status))
        if (rows.length === 0) return null
        return (
          <section key={group.key} className="goals-group">
            <p className="nav-section-label">{group.label}</p>
            <div className="goals-grid">
              {rows.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onNoteSave={handleNoteSave}
                  onStatusChange={handleStatus}
                  onOpen={(goal) => { setOpenId(goal.id); setDraft(goal.note || '') }}
                />
              ))}
            </div>
          </section>
        )
      })}

      {openId && (
        <div className="goal-editor-overlay">
          <div className="goal-editor-panel">
            <button className="icon-btn goal-editor-close" aria-label="close editor" onClick={closeEditor}>
              <X size={16} />
            </button>
            <Suspense fallback={<p className="muted">Loading editor…</p>}>
              <NoteEditor value={draft} onChange={setDraft} supabase={supabase} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/components/GoalsView.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GoalsView.jsx src/components/GoalsView.test.jsx
git commit -m "feat: goals view with grouped cards and inline editor"
```

---

## Task 5: Home widget (`src/components/widgets/GoalsWidget.jsx`)

**Files:**
- Create: `src/components/widgets/GoalsWidget.jsx`
- Test: `src/components/widgets/GoalsWidget.test.jsx`

**Interfaces:**
- Consumes: `getOrCreateGoalsTopic`, `listGoals` from `src/lib/db/goals.js`; `parseGoal` from `src/lib/goals.js`.
- Props: `GoalsWidget({ supabase, onGoToGoals })` — loads active goals, shows up to 3 nearest their target.
- Produces: compact rows; clicking the header or a row calls `onGoToGoals`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/widgets/GoalsWidget.test.jsx`:

```jsx
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import GoalsWidget from './GoalsWidget.jsx'

const goals = [
  { id: 'a', title: 'Near', note: '---\nstarted: 2026-07-01\ntarget: 2026-07-20\n---\n- [ ] x', status: 'active' },
  { id: 'b', title: 'Far', note: '---\nstarted: 2026-07-01\ntarget: 2026-12-01\n---\n- [ ] x', status: 'active' },
  { id: 'c', title: 'Someday', note: '', status: 'backlog' },
]

vi.mock('../../lib/db/goals.js', () => ({
  getOrCreateGoalsTopic: vi.fn(async () => ({ id: 't-goals' })),
  listGoals: vi.fn(async () => goals),
}))

describe('GoalsWidget', () => {
  beforeEach(() => vi.clearAllMocks())

  test('shows only active goals, nearest target first', async () => {
    render(<GoalsWidget supabase={{}} onGoToGoals={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Near')).toBeInTheDocument())
    expect(screen.getByText('Far')).toBeInTheDocument()
    expect(screen.queryByText('Someday')).toBeNull()
    const titles = screen.getAllByTestId('goal-widget-title').map((n) => n.textContent)
    expect(titles).toEqual(['Near', 'Far'])
  })

  test('clicking a row navigates to goals', async () => {
    const onGoToGoals = vi.fn()
    render(<GoalsWidget supabase={{}} onGoToGoals={onGoToGoals} />)
    await waitFor(() => expect(screen.getByText('Near')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Near'))
    expect(onGoToGoals).toHaveBeenCalled()
  })

  test('renders nothing when there are no active goals', async () => {
    const mod = await import('../../lib/db/goals.js')
    mod.listGoals.mockResolvedValueOnce([{ id: 'c', title: 'Someday', note: '', status: 'backlog' }])
    const { container } = render(<GoalsWidget supabase={{}} onGoToGoals={vi.fn()} />)
    await waitFor(() => expect(container.querySelector('.goals-widget')).toBeNull())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/components/widgets/GoalsWidget.test.jsx`
Expected: FAIL — cannot resolve `./GoalsWidget.jsx`.

- [ ] **Step 3: Implement `src/components/widgets/GoalsWidget.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { Target } from 'lucide-react'
import { getOrCreateGoalsTopic, listGoals } from '../../lib/db/goals.js'
import { parseGoal } from '../../lib/goals.js'

export default function GoalsWidget({ supabase, onGoToGoals }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    getOrCreateGoalsTopic(supabase)
      .then((topic) => listGoals(supabase, topic.id))
      .then((goals) => {
        if (!alive) return
        const active = goals
          .filter((g) => g.status === 'active' || !g.status)
          .map((g) => ({ ...g, parsed: parseGoal(g.note || '') }))
          .sort((a, b) => {
            const ta = a.parsed.target ? a.parsed.target.getTime() : Infinity
            const tb = b.parsed.target ? b.parsed.target.getTime() : Infinity
            return ta - tb
          })
          .slice(0, 3)
        setRows(active)
      })
      .catch(() => setRows([]))
    return () => { alive = false }
  }, [supabase])

  if (!rows || rows.length === 0) return null

  return (
    <div className="goals-widget">
      <button className="kw-label goals-widget-head" onClick={onGoToGoals}>
        <Target size={12} /> goals
      </button>
      {rows.map((g) => (
        <button key={g.id} className="goals-widget-row" onClick={onGoToGoals}>
          <span className="goals-widget-title" data-testid="goal-widget-title">{g.title}</span>
          <div className="goal-bar goal-bar--mini">
            <div className="goal-bar-fill goal-bar-steps" style={{ width: `${Math.round((g.parsed.stepPct || 0) * 100)}%` }} />
          </div>
          {g.parsed.daysLeft !== null && (
            <span className="goals-widget-days">{g.parsed.daysLeft >= 0 ? `${g.parsed.daysLeft}d` : 'over'}</span>
          )}
        </button>
      ))}
      <div className="kw-divider" />
    </div>
  )
}
```

- [ ] **Step 4: Add minimal widget styles to `src/styles.css`**

Append:

```css
.goals-widget-head { display: flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
.goals-widget-row { display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none; cursor: pointer; padding: 3px 0; text-align: left; }
.goals-widget-title { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.goal-bar--mini { width: 40px; flex: none; }
.goals-widget-days { font-size: 11px; color: var(--text-muted, #888); min-width: 26px; text-align: right; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/components/widgets/GoalsWidget.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/widgets/GoalsWidget.jsx src/components/widgets/GoalsWidget.test.jsx src/styles.css
git commit -m "feat: home goals widget (active goals by nearest deadline)"
```

---

## Task 6: Wire nav, view route, and widget into the app

**Files:**
- Modify: `src/components/NavSidebar.jsx` — import `Target`, add nav item.
- Modify: `src/App.jsx` — route `view === 'goals'`.
- Modify: `src/components/WidgetPanel.jsx` — mount `GoalsWidget`; thread `onGoToGoals`.

**Interfaces:**
- Consumes: `GoalsView`, `GoalsWidget`. `WidgetPanel` gains an `onGoToGoals` prop; `HomeView` passes it through (mirror the existing `onGoToFeed` threading).

- [ ] **Step 1: Add the nav item in `src/components/NavSidebar.jsx`**

In the icon import block (line 2-6), add `Target` to the `lucide-react` import list. Then in the `daily` section `items` array, after the `interview` item, add:

```js
      { view: 'goals', label: 'Goals', icon: Target },
```

- [ ] **Step 2: Route the view in `src/App.jsx`**

Add an import near the other view imports:

```js
import GoalsView from './components/GoalsView.jsx'
```

Add a route block alongside the other `view === ...` blocks (e.g., right after the `interview` block near line 994-996):

```jsx
          {view === 'goals' && (
            <GoalsView supabase={supabase} addToast={addToast} />
          )}
```

- [ ] **Step 3: Mount the widget in `src/components/WidgetPanel.jsx`**

Add the import:

```js
import GoalsWidget from './widgets/GoalsWidget.jsx'
```

Add `onGoToGoals` to the destructured props and mount the widget after `FocusWidget` (before the following `kw-divider`):

```jsx
export default function WidgetPanel({ supabase, onTrack, onSaveFeedItem, onGoToFeed, onOpenEntry, onGoToGoals }) {
```

```jsx
      <GoalsWidget supabase={supabase} onGoToGoals={onGoToGoals} />
      <div className="kw-divider" />
```

- [ ] **Step 4: Thread `onGoToGoals` from App through HomeView to WidgetPanel**

In `src/App.jsx`, find where `HomeView` is rendered (around line 905-918, where `onGoToFeed={() => setView('feed')}` is passed) and add:

```jsx
              onGoToGoals={() => setView('goals')}
```

In `src/components/HomeView.jsx`, add `onGoToGoals` to the component's destructured props and pass it to `<WidgetPanel ... onGoToGoals={onGoToGoals} />` (mirror how `onGoToFeed` is threaded).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus the new goals tests. If `NavSidebar` or `App` has a snapshot/structure test that enumerates nav items, update it to include the new `goals` item (that is an expected, correct change).

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no unresolved-import or syntax errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/NavSidebar.jsx src/App.jsx src/components/WidgetPanel.jsx src/components/HomeView.jsx
git commit -m "feat: wire Goals view into nav, routing, and home widget"
```

---

## Task 7: Manual verification pass

**Files:** none (manual QA + notes).

- [ ] **Step 1: Run the dev server**

Run: `npm run dev` and open the app.

- [ ] **Step 2: Exercise the flow**

- Click **Goals** in the sidebar → Goals view loads (creates the Goals topic on first visit).
- Click **New goal** → an editor opens with the frontmatter + one empty step template; type a title line and a couple of `- [ ]` steps; close the editor.
- Confirm the card shows a steps bar (`0/2`) and a time bar with days left.
- Click the up-next circle → the step checks off and the steps bar advances.
- Change a goal's status to **Someday** / **Done** → it moves groups (Done group present).
- Go to **Home** → the Goals widget lists the active goal with a mini bar; clicking it navigates to Goals.
- Run **Export** (existing feature) → confirm the goal appears as a normal markdown entry with its frontmatter and task list intact.

- [ ] **Step 3: Confirm no regressions**

Run: `npm test` once more.
Expected: PASS. Record anything surprising; if a real bug surfaces, fix it under systematic-debugging before marking the feature done.

---

## Self-Review Notes (author checklist — already applied)

- **Spec coverage:** goal=entry in `kind='goals'` topic (Task 2) ✓; frontmatter+task-list parsing and derived step/time bars (Task 1, 3) ✓; graceful degradation for missing dates/steps (Task 1 tests, Task 3 "no steps" test) ✓; complete-up-next mutation (Task 1 `toggleStep`, Task 3) ✓; grouped Active/Someday/Done card grid + New goal (Task 4) ✓; nav item with `Target` icon (Task 6) ✓; home widget of active goals nearest target (Task 5) ✓; export is free because goals are entries (Task 7 verification) ✓.
- **No migration** required — consistent with the spec (0042 made `kind` free-text).
- **Type consistency:** `parseGoal`/`deriveProgress`/`toggleStep`/`newGoalTemplate` signatures identical across Tasks 1, 3, 5. `getOrCreateGoalsTopic`/`listGoals`/`createGoal` identical across Tasks 2, 4, 5. `onNoteSave(id, note)`, `onStatusChange(id, status)`, `onOpen(goal)` identical across Tasks 3, 4.
- **Deferred (out of scope, per spec):** habits/streaks, nested sub-goals, reminders.
```
