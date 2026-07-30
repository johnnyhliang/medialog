import { test, expect, describe } from 'vitest'
import {
  dueReviews, patternStaleness, remainingProblems, paceStatus, actualWeeklyRate,
  suggestNext, MAX_REVIEWS_PER_SET, MAX_CONSECUTIVE_SAME_PATTERN,
  trackWeightsFromFocus, identifyGaps,
} from './interviewPlan.js'

const NOW = new Date('2026-07-29T12:00:00Z').getTime()
const daysFromNow = (d) => new Date(NOW + d * 86400000).toISOString()

const prob = (id, topic_id, over = {}) => ({
  id, topic_id, title: id, status: 'todo', difficulty: 'medium', confidence: null,
  srs_ef: 2.5, srs_reps: 0, ...over,
})
const solved = (id, topic_id, over = {}) => prob(id, topic_id, { status: 'done', confidence: 4, ...over })

describe('dueReviews', () => {
  const problems = [
    solved('a', 't1', { surface_after: daysFromNow(-5) }),
    solved('b', 't1', { surface_after: daysFromNow(-1) }),
    solved('c', 't1', { surface_after: daysFromNow(3) }),   // future
    solved('d', 't1', { surface_after: null }),             // never scheduled
    prob('e', 't1', { surface_after: daysFromNow(-9) }),     // unsolved, not a review
  ]

  test('returns only overdue solved problems, oldest first', () => {
    expect(dueReviews(problems, NOW).map((p) => p.id)).toEqual(['a', 'b'])
  })

  test('nothing is due when no review dates have passed', () => {
    expect(dueReviews([solved('x', 't1', { surface_after: daysFromNow(1) })], NOW)).toEqual([])
  })
})

describe('patternStaleness', () => {
  test('is the overdue fraction of solved problems', () => {
    const problems = [
      solved('a', 't1', { surface_after: daysFromNow(-1) }),
      solved('b', 't1', { surface_after: daysFromNow(-1) }),
      solved('c', 't1', { surface_after: daysFromNow(9) }),
      prob('d', 't1'), // unsolved doesn't count either way
    ]
    expect(patternStaleness(problems, NOW)).toBeCloseTo(2 / 3)
  })

  test('a pattern with nothing solved is not stale', () => {
    expect(patternStaleness([prob('a', 't1')], NOW)).toBe(0)
    expect(patternStaleness([], NOW)).toBe(0)
  })
})

describe('remaining + pace', () => {
  const patterns = [
    { id: 't1', name: 'Arrays', tracks: ['swe'], pattern_target: 5 },
    { id: 't2', name: 'Graphs', tracks: ['swe'], pattern_target: 4 },
  ]
  const problemsByTopic = {
    t1: [solved('a', 't1'), solved('b', 't1'), prob('c', 't1')],
    t2: [prob('d', 't2')],
  }

  test('remaining counts the gap to each target', () => {
    // t1: 5 - 2 = 3, t2: 4 - 0 = 4
    expect(remainingProblems(patterns, problemsByTopic)).toBe(7)
  })

  test('an over-target pattern contributes zero, never negative', () => {
    const over = { t1: [solved('a', 't1'), solved('b', 't1'), solved('c', 't1'),
      solved('d', 't1'), solved('e', 't1'), solved('f', 't1')] }
    expect(remainingProblems([patterns[0]], over)).toBe(0)
  })

  test('no target date is a first-class state, not an error', () => {
    const s = paceStatus({ patterns, problemsByTopic, targetDate: null, now: NOW })
    expect(s.verdict).toBe('no_target')
    expect(s.requiredRate).toBeNull()
    expect(s.remaining).toBe(7)
  })

  test('required rate is remaining over weeks left', () => {
    // 7 remaining, 7 days out = 1 week → 7/week
    const s = paceStatus({ patterns, problemsByTopic, targetDate: daysFromNow(7), now: NOW })
    expect(s.requiredRate).toBeCloseTo(7)
    expect(s.verdict).toBe('behind') // actual rate is 0
  })

  test('behind when actual lags required', () => {
    const recent = {
      t1: [solved('a', 't1', { updated_at: daysFromNow(-1) }), solved('b', 't1', { updated_at: daysFromNow(-2) }), prob('c', 't1')],
      t2: [prob('d', 't2')],
    }
    const s = paceStatus({ patterns, problemsByTopic: recent, targetDate: daysFromNow(7), now: NOW })
    expect(s.actualRate).toBe(1) // 2 solved in 14d
    expect(s.verdict).toBe('behind')
  })

  test('ahead once nothing remains', () => {
    const done = {
      t1: Array.from({ length: 5 }, (_, i) => solved(`a${i}`, 't1')),
      t2: Array.from({ length: 4 }, (_, i) => solved(`b${i}`, 't2')),
    }
    const s = paceStatus({ patterns, problemsByTopic: done, targetDate: daysFromNow(7), now: NOW })
    expect(s.verdict).toBe('ahead')
    expect(s.remaining).toBe(0)
  })

  test('a passed target date reports behind rather than an infinite rate', () => {
    const s = paceStatus({ patterns, problemsByTopic, targetDate: daysFromNow(-3), now: NOW })
    expect(s.verdict).toBe('behind')
    expect(Number.isFinite(s.requiredRate)).toBe(true)
  })

  test('actualWeeklyRate ignores work older than the trailing fortnight', () => {
    const old = { t1: [solved('a', 't1', { updated_at: daysFromNow(-30) })] }
    expect(actualWeeklyRate(old, NOW)).toBe(0)
  })
})

describe('trackWeightsFromFocus', () => {
  test('no focus weights everything equally rather than guessing', () => {
    expect(trackWeightsFromFocus([])).toEqual({ __default: 1 })
    expect(trackWeightsFromFocus(null)).toEqual({ __default: 1 })
  })

  test('focused tracks outweigh the rest', () => {
    const w = trackWeightsFromFocus(['swe', 'sysdesign'])
    expect(w.swe).toBe(3)
    expect(w.sysdesign).toBe(3)
    expect(w.__default).toBe(1)
  })
})

describe('identifyGaps', () => {
  const patterns = [
    { id: 't1', name: 'Uncovered', tracks: ['swe'], pattern_target: 3 },
    { id: 't2', name: 'Stale', tracks: ['swe'], pattern_target: 1 },
    { id: 't3', name: 'Shaky', tracks: ['qt'], pattern_target: 1 },
    { id: 't4', name: 'Solid', tracks: ['swe'], pattern_target: 1 },
  ]
  const problemsByTopic = {
    t1: [prob('a', 't1')],
    t2: [solved('b', 't2', { confidence: 5, surface_after: daysFromNow(-3) })],
    t3: [solved('c', 't3', { confidence: 1, surface_after: daysFromNow(30) })],
    t4: [solved('d', 't4', { confidence: 5, surface_after: daysFromNow(30) })],
  }

  test('classifies each gap kind distinctly and omits solid patterns', () => {
    const gaps = identifyGaps({ patterns, problemsByTopic, now: NOW })
    const byId = Object.fromEntries(gaps.map((g) => [g.patternId, g.kind]))
    expect(byId).toEqual({ t1: 'uncovered', t2: 'stale', t3: 'shaky' })
    expect(gaps.find((g) => g.patternId === 't4')).toBeUndefined()
  })

  test('reports how many problems are missing for uncovered patterns', () => {
    const gaps = identifyGaps({ patterns, problemsByTopic, now: NOW })
    expect(gaps.find((g) => g.patternId === 't1').missing).toBe(3)
  })

  test('a pivot reorders gaps without touching any problem', () => {
    const swe = identifyGaps({ patterns, problemsByTopic, focus: ['swe'], now: NOW })
    const qt = identifyGaps({ patterns, problemsByTopic, focus: ['qt'], now: NOW })
    expect(swe[0].inFocus).toBe(true)
    expect(swe[0].patternId).not.toBe('t3')
    // Focusing qt promotes the qt pattern to the top of the same data.
    expect(qt[0].patternId).toBe('t3')
  })

  test('respects the limit', () => {
    expect(identifyGaps({ patterns, problemsByTopic, now: NOW, limit: 2 })).toHaveLength(2)
  })
})

describe('suggestNext', () => {
  const patterns = [
    { id: 't1', name: 'Arrays', tracks: ['swe'], pattern_target: 3 },
    { id: 't2', name: 'Graphs', tracks: ['swe'], pattern_target: 3 },
    { id: 't3', name: 'DP', tracks: ['qt'], pattern_target: 3 },
  ]

  test('due reviews outrank every unsolved problem', () => {
    const problemsByTopic = {
      t1: [solved('r1', 't1', { surface_after: daysFromNow(-4) }), prob('n1', 't1')],
      t2: [prob('n2', 't2')],
      t3: [prob('n3', 't3')],
    }
    const set = suggestNext({ patterns, problemsByTopic, size: 2, now: NOW })
    expect(set[0]).toMatchObject({ reason: 'review' })
    expect(set[0].problem.id).toBe('r1')
  })

  test('reviews are capped so they cannot consume the whole set', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      solved(`r${i}`, 't1', { surface_after: daysFromNow(-10 + i) }))
    const problemsByTopic = { t1: many, t2: [prob('n2', 't2')], t3: [prob('n3', 't3')] }
    const set = suggestNext({ patterns, problemsByTopic, size: 5, now: NOW })
    expect(set.filter((s) => s.reason === 'review')).toHaveLength(MAX_REVIEWS_PER_SET)
    expect(set.filter((s) => s.reason === 'new').length).toBeGreaterThan(0)
  })

  test('picks the easiest unsolved problem in a pattern, not the hardest', () => {
    const problemsByTopic = {
      t1: [prob('hard', 't1', { difficulty: 'hard' }), prob('easy', 't1', { difficulty: 'easy' })],
    }
    const set = suggestNext({ patterns: [patterns[0]], problemsByTopic, size: 1, now: NOW })
    expect(set[0].problem.id).toBe('easy')
  })

  test('prefers the weaker pattern', () => {
    const problemsByTopic = {
      // t1 nearly covered and well mastered, t2 untouched
      t1: [solved('a', 't1', { confidence: 5 }), solved('b', 't1', { confidence: 5 }), prob('c', 't1')],
      t2: [prob('d', 't2')],
    }
    const set = suggestNext({ patterns: [patterns[0], patterns[1]], problemsByTopic, size: 1, now: NOW })
    expect(set[0].patternId).toBe('t2')
  })

  test('does not suggest new work from a pattern already at full coverage', () => {
    const problemsByTopic = {
      t1: [solved('a', 't1'), solved('b', 't1'), solved('c', 't1'), prob('extra', 't1')],
      t2: [prob('d', 't2')],
    }
    const set = suggestNext({ patterns: [patterns[0], patterns[1]], problemsByTopic, size: 4, now: NOW })
    expect(set.every((s) => s.patternId !== 't1')).toBe(true)
  })

  test('will not tunnel more than the allowed run into one pattern', () => {
    const problemsByTopic = {
      t1: Array.from({ length: 5 }, (_, i) => prob(`a${i}`, 't1')),
      t2: Array.from({ length: 5 }, (_, i) => prob(`b${i}`, 't2')),
    }
    const set = suggestNext({ patterns: [patterns[0], patterns[1]], problemsByTopic, size: 5, now: NOW })
    let run = 1
    for (let i = 1; i < set.length; i++) {
      run = set[i].patternId === set[i - 1].patternId ? run + 1 : 1
      expect(run).toBeLessThanOrEqual(MAX_CONSECUTIVE_SAME_PATTERN)
    }
  })

  test('track weights bias which pattern is chosen', () => {
    const problemsByTopic = { t2: [prob('d', 't2')], t3: [prob('e', 't3')] }
    const set = suggestNext({
      patterns: [patterns[1], patterns[2]],
      problemsByTopic,
      trackWeights: { qt: 3 },
      size: 1,
      now: NOW,
    })
    expect(set[0].patternId).toBe('t3')
  })

  test('returns an empty set when there is nothing to do — caught up is the goal', () => {
    const problemsByTopic = {
      t1: [solved('a', 't1', { surface_after: daysFromNow(5) }),
        solved('b', 't1', { surface_after: daysFromNow(5) }),
        solved('c', 't1', { surface_after: daysFromNow(5) })],
    }
    expect(suggestNext({ patterns: [patterns[0]], problemsByTopic, size: 5, now: NOW })).toEqual([])
  })

  test('never returns the same problem twice', () => {
    const problemsByTopic = { t1: [prob('a', 't1')], t2: [prob('b', 't2')] }
    const set = suggestNext({ patterns: [patterns[0], patterns[1]], problemsByTopic, size: 5, now: NOW })
    expect(new Set(set.map((s) => s.problem.id)).size).toBe(set.length)
  })
})
