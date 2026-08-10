/**
 * The two mechanizable rules from docs/manager-scope.md §2b.
 *
 * §2b lists four tests for anything added to the Manager. Two of them need a
 * human (does it remove a decision; can you act on it where you see it). The
 * other two are just code, and leaving them as prose in a document is how
 * goals.js died — a checklist nobody re-reads enforces nothing.
 *
 *   RULE 2  Does it still work if you ignore it for a month?
 *   RULE 4  Does it stay quiet when there is nothing to say?
 *
 * This file is deliberately cross-cutting rather than per-module: the failure
 * it exists to catch is a surface that looks fine in its own unit test and
 * turns into noise once time passes. That is exactly what happened — two
 * programs read "open now" for 51 days because every test asked "does it show?"
 * and none asked "does it ever stop?".
 *
 * WHEN YOU ADD A DATED OR DERIVED SURFACE, ADD IT HERE.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { buildDeadlines } from '../../src/lib/deadlines.js'
import { buildAgenda, phraseForRow, pressingCount } from '../../src/lib/orgAgenda.js'
import { buildGrid, currentStreak, totalIn, activeDays } from '../../src/lib/contributions.js'
import { buildManager, momentumFor, progressFor } from '../../src/lib/manager.js'
import { parseFrontmatter, parseSteps } from '../../src/lib/goals.js'
import { staticPicks } from '../../src/lib/practice.js'

import ContributionGrid from '../../src/components/ContributionGrid.jsx'
import AgendaPane from '../../src/components/AgendaPane.jsx'
import ManagerView from '../../src/components/ManagerView.jsx'
import DeadlineAlertBanner from '../../src/components/widgets/DeadlineAlertBanner.jsx'

vi.mock('../../src/lib/db/deadlines.js', () => ({ listDeadlines: vi.fn() }))
const { listDeadlines } = await import('../../src/lib/db/deadlines.js')

const NOW = new Date('2026-08-10T15:00:00Z')
const NY = 'America/New_York'

// A month, a quarter, a year, and long enough that nobody was ever coming back.
const NEGLECT = [30, 90, 365, 1000]
const later = (days) => new Date(NOW.getTime() + days * 86400000)

// Words this app has decided never to say. Checked against every string any of
// these surfaces can produce, at every time offset.
const FORBIDDEN = /overdue|behind schedule|you missed|late\b|failed|streak broken/i

// ───────────────────────────────────────────────────────────────────────────
// RULE 2 — it must still work if you ignore it for a month.
// ───────────────────────────────────────────────────────────────────────────

describe('rule 2: surviving neglect', () => {
  const openWindow = {
    id: 'p1', name: 'Neo Scholars', url: null, deadline: null,
    category: 'program', window_open: true, last_checked: '2026-08-01',
  }

  test.each(NEGLECT)('an undated open window is gone after %i days', (days) => {
    // THE REGRESSION. 8VC and Neo Scholars read "open now" for 51 days because
    // window_open never expired. If this ever passes rows again, that is back.
    expect(buildDeadlines({ programs: [openWindow], now: later(days), tz: NY })).toEqual([])
  })

  test.each(NEGLECT)('a dated deadline stops showing once it passes (+%i days)', (days) => {
    const p = { ...openWindow, deadline: '2026-08-20', window_open: false }
    expect(buildDeadlines({ programs: [p], now: later(days), tz: NY })).toEqual([])
  })

  const datedProject = [{
    id: 't1', name: 'Order Book',
    master_doc: '---\ntarget: 2026-09-30\n---\n- [ ] Phase 0 @2026-08-20\n',
  }]

  test('a passed scheduled step leaves the agenda after its grace period', () => {
    // THE SECOND REGRESSION, found by this very file. buildAgenda bounded only
    // the FUTURE, so a step dated 2026-08-20 was still listed at daysLeft:
    // -1000. An unbounded list of dates you slipped is the nag list §2b rules
    // out — and it is the same shape as the "open now forever" bug.
    const within = buildAgenda({ projects: datedProject, deadlines: [], now: later(13), tz: NY })
    expect(within.some((r) => r.key === 'step:t1:0')).toBe(true)

    const past = buildAgenda({ projects: datedProject, deadlines: [], now: later(30), tz: NY })
    expect(past.some((r) => r.key === 'step:t1:0')).toBe(false)
  })

  test('the step survives on the PLAN after it leaves the agenda', () => {
    // Ageing off the agenda must never mean losing the work.
    const { steps } = parseSteps(parseFrontmatter(datedProject[0].master_doc).body)
    expect(steps.filter((s) => !s.checked)).toHaveLength(1)
  })

  test.each(NEGLECT)('the agenda empties rather than accumulating (+%i days)', (days) => {
    const rows = buildAgenda({ projects: datedProject, deadlines: [], now: later(days), tz: NY })
    // At +30 the plan target (2026-09-30) is genuinely still 21 days out, so it
    // belongs. The slipped step has aged out, and by +90 nothing remains.
    expect(rows.map((r) => r.key)).toEqual(days === 30 ? ['plan:t1'] : [])
    expect(pressingCount(rows)).toBe(0)
  })

  test.each(NEGLECT)('the grid degrades to empty, never to negative or NaN (+%i days)', (days) => {
    const rows = [{ day: '2026-08-09', kind: 'step' }]
    const grid = buildGrid(rows, { weeks: 26, now: later(days), tz: NY })
    expect(grid).toHaveLength(26)
    expect(grid.flat().every((d) => Number.isInteger(d.count) && d.count >= 0)).toBe(true)
    expect(totalIn(grid)).toBeGreaterThanOrEqual(0)
    expect(activeDays(grid)).toBeGreaterThanOrEqual(0)
  })

  test.each(NEGLECT)('a broken streak reads 0, never a negative count (+%i days)', (days) => {
    const streak = currentStreak([{ day: '2026-08-09' }], { now: later(days), tz: NY })
    expect(streak).toBe(0)
  })

  test.each(NEGLECT)('momentum goes cold and stays cold, never throws (+%i days)', (days) => {
    expect(momentumFor('2026-08-09T00:00:00Z', later(days))).toBe('cold')
    expect(momentumFor(null, later(days))).toBe('cold')
    expect(momentumFor('nonsense', later(days))).toBe('cold')
  })

  test.each(NEGLECT)('manager cards still build from stale data (+%i days)', (days) => {
    const topics = [{ id: 't1', name: 'Systems', master_doc: '', updated_at: '2026-08-09T00:00:00Z' }]
    const { active } = buildManager({ topics, entries: [], states: [], now: later(days) })
    expect(active).toHaveLength(1)
    expect(active[0].momentum).toBe('cold')
    // No plan means no progress chrome, at any distance in time.
    expect(active[0].progress).toBe(null)
  })

  test.each(NEGLECT)('the practice card still picks a valid problem (+%i days)', (days) => {
    const picks = staticPicks(later(days), NY)
    expect(picks).toHaveLength(2)
    for (const p of picks) expect(p.url).toMatch(/^https:\/\//)
  })

  test.each(NEGLECT)('no surface says a forbidden word (+%i days)', (days) => {
    const projects = [{
      id: 't1', name: 'Order Book',
      master_doc: '---\nstarted: 2026-01-01\ntarget: 2026-09-30\n---\n- [ ] Phase 0 @2026-08-20\n',
    }]
    const rows = buildAgenda({
      projects,
      deadlines: buildDeadlines({ programs: [openWindow], now: later(days), tz: NY }),
      horizonDays: 100000, // widen it: we WANT the stale rows here, to read them
      now: later(days),
      tz: NY,
    })
    for (const r of rows) expect(phraseForRow(r)).not.toMatch(FORBIDDEN)
  })

  test('a long-overdue plan reports behind WITHOUT the word', () => {
    // progressFor may legitimately flag `behind: true` — that is a boolean the
    // Manager renders as a small chip. What must never happen is the dated
    // surfaces adopting the vocabulary. Guard the boolean stays a boolean.
    const p = progressFor('---\nstarted: 2026-01-01\ntarget: 2026-02-01\n---\n- [ ] a\n', later(365))
    expect(p.behind).toBe(true)
    expect(typeof p.behind).toBe('boolean')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// RULE 4 — it must stay quiet when there is nothing to say.
// ───────────────────────────────────────────────────────────────────────────

describe('rule 4: quiet when empty', () => {
  beforeEach(() => {
    localStorage.clear()
    listDeadlines.mockReset()
  })

  test('DeadlineAlertBanner renders literally nothing', async () => {
    listDeadlines.mockResolvedValue([])
    const { container } = render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    await waitFor(() => expect(listDeadlines).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })

  test('AgendaPane offers instructions, not fabricated rows', () => {
    const { container } = render(<AgendaPane projects={[]} deadlines={[]} timezone={NY} />)
    expect(container.querySelectorAll('.agenda-row')).toHaveLength(0)
    // An empty agenda should teach you how to fill it, which is the one useful
    // thing it can say when it has no content.
    expect(screen.getByText(/Nothing dated/)).toBeInTheDocument()
  })

  test('ContributionGrid shows no streak and no zero', () => {
    render(<ContributionGrid rows={[]} weeks={4} now={NOW} tz={NY} />)
    expect(screen.getByText('no contributions yet')).toBeInTheDocument()
    // A "0 day streak" is the shaming counter §6 rules out.
    expect(screen.queryByText(/day run/)).not.toBeInTheDocument()
  })

  test('ManagerView says nothing is drifting, and shows no cards', () => {
    const { container } = render(
      <ManagerView topics={[]} entries={[]} states={[]} contributions={[]} timezone={NY} />,
    )
    expect(container.querySelectorAll('.manager-card')).toHaveLength(0)
    expect(screen.getByText('nothing is drifting')).toBeInTheDocument()
  })

  test('no empty surface uses a forbidden word', () => {
    const { container } = render(
      <>
        <AgendaPane projects={[]} deadlines={[]} timezone={NY} />
        <ContributionGrid rows={[]} weeks={4} now={NOW} tz={NY} />
        <ManagerView topics={[]} entries={[]} states={[]} contributions={[]} timezone={NY} />
      </>,
    )
    expect(container.textContent).not.toMatch(FORBIDDEN)
  })

  test('an empty grid draws squares but claims nothing about them', () => {
    const { container } = render(<ContributionGrid rows={[]} weeks={4} now={NOW} tz={NY} />)
    // Squares are the calendar itself, not content — but every past one must
    // read as "nothing", never as a miss.
    const past = [...container.querySelectorAll('.cgrid-day:not(.cgrid-day--future)')]
    expect(past.length).toBeGreaterThan(0)
    for (const sq of past) expect(sq.getAttribute('title')).toMatch(/^nothing on /)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Stated exemptions. A rule with undocumented exceptions is a rule that erodes.
// ───────────────────────────────────────────────────────────────────────────

describe('exemptions from rule 4, on purpose', () => {
  test('PracticeCard always shows something — it is a suggestion, not a status', () => {
    // Rule 4 governs surfaces that REPORT. Practice offers; "nothing to say" is
    // not a state it has. What it must be instead is BOUNDED, so it can never
    // grow into the backlog the three-row limit exists to prevent.
    expect(staticPicks(NOW, NY)).toHaveLength(2)
  })
})
