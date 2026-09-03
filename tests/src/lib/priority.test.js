import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ESTIMATE_MINUTES,
  TIERS,
  assessWeek,
  rankTasks,
  tierFor,
} from '../../../src/lib/priority.js'

// Fixed clock. Every date below is written relative to this so the assertions
// say what they mean.
const NOW = new Date('2026-09-07T14:00:00Z')
const TZ = 'America/Detroit'
const hoursOut = (h) => new Date(NOW.getTime() + h * 3600 * 1000).toISOString()
const daysOut = (d) => hoursOut(d * 24)

const entry = (over = {}) => ({
  id: over.title ?? 'e',
  title: 'e',
  topicName: 'EECS 489',
  tags: [],
  status: null,
  due_at: null,
  ...over,
})

describe('tierFor', () => {
  it('puts anything due inside 48 hours at the top', () => {
    expect(tierFor(entry({ due_at: hoursOut(10) }), NOW)).toBe(TIERS.IMMINENT)
  })

  it('treats an overdue entry as imminent rather than dropping it', () => {
    expect(tierFor(entry({ due_at: hoursOut(-30) }), NOW)).toBe(TIERS.IMMINENT)
  })

  it('ranks a distant gating item above a routine one due tomorrow', () => {
    const gating = entry({ tags: ['gating'], due_at: daysOut(21) })
    const routine = entry({ due_at: daysOut(3) })
    expect(tierFor(gating, NOW)).toBeLessThan(tierFor(routine, NOW))
  })

  it('demotes self-paced work even when it carries a near date', () => {
    // The failure this prevents: an optimistic self-assigned date borrowing
    // urgency and displacing work that genuinely cannot move.
    const selfPaced = entry({ tags: ['selfpaced'], due_at: hoursOut(2) })
    expect(tierFor(selfPaced, NOW)).toBe(TIERS.SELF_PACED)
  })

  it('prioritises the nominated hardest course over other coursework', () => {
    const hard = entry({ topicName: 'EECS 470', due_at: daysOut(10) })
    const other = entry({ topicName: 'EECS 489', due_at: daysOut(10) })
    const opts = { hardestCourse: '470' }
    expect(tierFor(hard, NOW, opts)).toBeLessThan(tierFor(other, NOW, opts))
  })
})

describe('rankTasks', () => {
  it('returns at most three, each carrying the rule that chose it', () => {
    const entries = [
      entry({ id: 'a', title: 'a', due_at: daysOut(9) }),
      entry({ id: 'b', title: 'b', due_at: hoursOut(5) }),
      entry({ id: 'c', title: 'c', tags: ['gating'], due_at: daysOut(20) }),
      entry({ id: 'd', title: 'd', tags: ['waiting'] }),
      entry({ id: 'e', title: 'e', tags: ['selfpaced'] }),
    ]
    const { next, total } = rankTasks(entries, NOW, { timezone: TZ })
    expect(total).toBe(5)
    expect(next.map((t) => t.id)).toEqual(['b', 'c', 'd'])
    expect(next[0].reason).toMatch(/48 hours/)
  })

  it('excludes finished work', () => {
    const entries = [
      entry({ id: 'done', title: 'done', status: 'done', due_at: hoursOut(1) }),
      entry({ id: 'live', title: 'live', due_at: daysOut(4) }),
    ]
    expect(rankTasks(entries, NOW, {}).next.map((t) => t.id)).toEqual(['live'])
  })

  it('sorts undated work last within its tier', () => {
    const entries = [
      entry({ id: 'undated', title: 'undated' }),
      entry({ id: 'dated', title: 'dated', due_at: daysOut(12) }),
    ]
    expect(rankTasks(entries, NOW, {}).next.map((t) => t.id)).toEqual(['dated', 'undated'])
  })
})

describe('assessWeek', () => {
  it('reports a fit when estimates sit inside the available slack', () => {
    const entries = [
      entry({ id: 'a', due_at: daysOut(2), estimate_minutes: 120 }),
      entry({ id: 'b', due_at: daysOut(4), estimate_minutes: 60 }),
    ]
    const result = assessWeek(entries, 6, NOW)
    expect(result.fits).toBe(true)
    expect(result.required_hours).toBe(3)
    expect(result.deficit_hours).toBe(0)
  })

  it('ignores work due beyond the horizon', () => {
    const entries = [
      entry({ id: 'near', due_at: daysOut(3), estimate_minutes: 60 }),
      entry({ id: 'far', due_at: daysOut(30), estimate_minutes: 600 }),
    ]
    expect(assessWeek(entries, 2, NOW).deliverables).toBe(1)
  })

  it('counts how many entries it had to guess at', () => {
    const entries = [
      entry({ id: 'a', due_at: daysOut(1), estimate_minutes: 30 }),
      entry({ id: 'b', due_at: daysOut(2) }),
    ]
    const result = assessWeek(entries, 10, NOW)
    expect(result.unestimated).toBe(1)
    expect(result.required_hours).toBe((30 + DEFAULT_ESTIMATE_MINUTES) / 60)
  })

  it('proposes cuts from the bottom of the ladder and never the top', () => {
    const entries = [
      entry({ id: 'imminent', title: 'imminent', due_at: hoursOut(6), estimate_minutes: 180 }),
      entry({ id: 'gating', title: 'gating', tags: ['gating'], due_at: daysOut(5), estimate_minutes: 30 }),
      entry({ id: 'routine', title: 'routine', due_at: daysOut(6), estimate_minutes: 120 }),
      entry({ id: 'paced', title: 'paced', tags: ['selfpaced'], due_at: daysOut(4), estimate_minutes: 120 }),
    ]
    const result = assessWeek(entries, 4, NOW)
    expect(result.fits).toBe(false)
    const cutIds = result.cuts.map((c) => c.id)
    expect(cutIds).not.toContain('imminent')
    expect(cutIds).not.toContain('gating')
    // Self-paced is the deepest rung, so it goes before routine coursework.
    expect(cutIds[0]).toBe('paced')
  })

  it('admits when the cut list cannot close the gap', () => {
    const entries = [
      entry({ id: 'a', due_at: hoursOut(4), estimate_minutes: 600 }),
      entry({ id: 'b', due_at: daysOut(3), estimate_minutes: 60 }),
    ]
    const result = assessWeek(entries, 1, NOW)
    expect(result.fits).toBe(false)
    // Only 'b' is deferrable; the imminent 10-hour item is not.
    expect(result.still_short_hours).toBeGreaterThan(0)
  })
})
