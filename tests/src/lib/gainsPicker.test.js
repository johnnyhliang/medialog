import { test, expect, describe } from 'vitest'
import {
  staleWeights, weightedPick, dueReviews, openMenuItems, suggestNext,
  QUANT_STRANDS, FLOOR_ITEMS,
} from '../../../src/lib/gainsPicker.js'

const NOW = new Date('2026-07-30T12:00:00Z').getTime()
const daysFromNow = (d) => new Date(NOW + d * 86400000).toISOString()
const rngSeq = (vals) => { let i = 0; return () => vals[i++ % vals.length] }

describe('staleWeights', () => {
  test('longer since last touched gets more weight', () => {
    const weights = staleWeights(['a', 'b'], { a: daysFromNow(-1), b: daysFromNow(-10) }, NOW)
    expect(weights.b).toBeGreaterThan(weights.a)
  })

  test('never touched defaults to a high, non-zero weight', () => {
    const weights = staleWeights(['a'], {}, NOW)
    expect(weights.a).toBeGreaterThan(0)
  })

  test('weight is capped so one very stale item cannot dominate completely', () => {
    const weights = staleWeights(['a'], { a: daysFromNow(-9000) }, NOW)
    expect(weights.a).toBeLessThanOrEqual(30)
  })
})

describe('weightedPick', () => {
  test('deterministic with an injected rng', () => {
    const weights = { a: 1, b: 3 }
    expect(weightedPick(weights, () => 0)).toBe('a')
    expect(weightedPick(weights, () => 0.99)).toBe('b')
  })

  test('returns null when nothing has positive weight', () => {
    expect(weightedPick({ a: 0, b: 0 })).toBeNull()
  })
})

describe('dueReviews', () => {
  test('overdue entries only, oldest first', () => {
    const entries = [
      { id: 'a', surface_after: daysFromNow(-5) },
      { id: 'b', surface_after: daysFromNow(-1) },
      { id: 'c', surface_after: daysFromNow(3) },
      { id: 'd', surface_after: null },
    ]
    expect(dueReviews(entries, NOW).map((e) => e.id)).toEqual(['a', 'b'])
  })
})

describe('openMenuItems', () => {
  const items = [
    { id: 'a', track: 'quant-build', status: 'open', last_pulled_at: daysFromNow(-1) },
    { id: 'b', track: 'quant-build', status: 'open', last_pulled_at: null },
    { id: 'c', track: 'quant-build', status: 'done', last_pulled_at: null },
    { id: 'd', track: 'quant-read', status: 'open', last_pulled_at: null },
  ]

  test('filters to open items in the track, never-pulled first', () => {
    expect(openMenuItems(items, 'quant-build').map((i) => i.id)).toEqual(['b', 'a'])
  })

  test('dropped/done items never surface', () => {
    expect(openMenuItems(items, 'quant-build').find((i) => i.id === 'c')).toBeUndefined()
  })
})

describe('suggestNext', () => {
  test('a due review wins outright over everything else', () => {
    const result = suggestNext({
      reviewEntries: [{ id: 'r1', track: 'quant', surface_after: daysFromNow(-2) }],
      menuItems: [{ id: 'm1', track: 'quant-build', status: 'open', last_pulled_at: null }],
      devNextSection: { id: 's1', title: 'ch. 1' },
      interviewNext: { id: 'p1', title: 'Two Sum' },
      now: NOW,
    })
    expect(result.tier).toBe('review')
    expect(result.item.id).toBe('r1')
  })

  test('picks dev when weighted toward it', () => {
    const result = suggestNext({
      devNextSection: { id: 's1', title: 'ch. 1' },
      interviewNext: null,
      menuItems: [],
      now: NOW,
      rng: rngSeq([0]), // first available track wins with rng()=0
    })
    expect(result.tier).toBe('new')
    expect(result.track).toBe('dev')
  })

  test('quant picks a strand then the least-recently-pulled open item', () => {
    const menuItems = [
      { id: 'a', track: 'quant-build', status: 'open', last_pulled_at: daysFromNow(-1) },
      { id: 'b', track: 'quant-build', status: 'open', last_pulled_at: null },
    ]
    const result = suggestNext({
      menuItems,
      devNextSection: null,
      interviewNext: null,
      now: NOW,
      rng: rngSeq([0, 0]), // track pick then strand pick both take the first option
    })
    expect(result.tier).toBe('new')
    expect(result.track).toBe('quant')
    expect(QUANT_STRANDS).toContain(result.strand)
    expect(result.item.id).toBeDefined()
  })

  test('returns null when every track is empty', () => {
    expect(suggestNext({ menuItems: [], devNextSection: null, interviewNext: null, now: NOW })).toBeNull()
  })

  test('floor items exist for every track as the bad-day bypass', () => {
    expect(Object.keys(FLOOR_ITEMS)).toEqual(['quant', 'dev', 'interview'])
  })
})
