import { describe, test, expect } from 'vitest'
import {
  dayKey, todayKey, shiftKey, countsByDay, intensity,
  buildGrid, currentStreak, totalIn, activeDays, monthLabels,
} from '../../../src/lib/contributions.js'

// A fixed clock so these mean the same thing in every CI timezone.
// 2026-08-07T15:00:00Z is Friday 11:00 in New York and Saturday 00:00 in Tokyo.
const NOW = new Date('2026-08-07T15:00:00Z')
const NY = 'America/New_York'
const TOKYO = 'Asia/Tokyo'

const on = (day) => ({ day, kind: 'step' })

describe('dayKey', () => {
  test('resolves the calendar day in the given zone, not UTC', () => {
    expect(dayKey(NOW, NY)).toBe('2026-08-07')
    expect(dayKey(NOW, TOKYO)).toBe('2026-08-08')
  })

  test('late-evening work stays on the day it was done', () => {
    // 2026-08-07T23:30 in New York is already the 8th in UTC.
    const lateNight = new Date('2026-08-08T03:30:00Z')
    expect(lateNight.toISOString().slice(0, 10)).toBe('2026-08-08')
    expect(dayKey(lateNight, NY)).toBe('2026-08-07')
  })

  test('pads single-digit months and days', () => {
    expect(dayKey(new Date('2026-01-05T18:00:00Z'), NY)).toBe('2026-01-05')
  })
})

describe('shiftKey', () => {
  test('steps forward and back', () => {
    expect(shiftKey('2026-08-07', 1)).toBe('2026-08-08')
    expect(shiftKey('2026-08-07', -1)).toBe('2026-08-06')
  })

  test('crosses month and year boundaries', () => {
    expect(shiftKey('2026-08-31', 1)).toBe('2026-09-01')
    expect(shiftKey('2026-01-01', -1)).toBe('2025-12-31')
  })

  test('handles a leap day', () => {
    expect(shiftKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftKey('2028-03-01', -1)).toBe('2028-02-29')
  })

  test('does not drift across a DST transition', () => {
    // US DST ends 2026-11-01. Calendar arithmetic must not produce a 23/25h day.
    expect(shiftKey('2026-10-31', 3)).toBe('2026-11-03')
  })
})

describe('countsByDay', () => {
  test('counts rows per day', () => {
    const counts = countsByDay([on('2026-08-07'), on('2026-08-07'), on('2026-08-05')])
    expect(counts).toEqual({ '2026-08-07': 2, '2026-08-05': 1 })
  })

  test('passes through a bare YYYY-MM-DD without touching the timezone', () => {
    // A Postgres `date` is already the local day; re-resolving it through a zone
    // would shift it by one for anyone west of UTC.
    expect(countsByDay([on('2026-08-07')], TOKYO)).toEqual({ '2026-08-07': 1 })
  })

  test('converts a full timestamp through the zone', () => {
    expect(countsByDay([{ day: '2026-08-07T15:00:00Z' }], TOKYO)).toEqual({ '2026-08-08': 1 })
    expect(countsByDay([{ day: new Date('2026-08-07T15:00:00Z') }], NY)).toEqual({ '2026-08-07': 1 })
  })

  test('drops junk instead of throwing', () => {
    expect(countsByDay([null, undefined, {}, { day: null }, { day: 'nope' }, { day: 42 }], NY)).toEqual({})
    expect(countsByDay(undefined)).toEqual({})
  })
})

describe('intensity', () => {
  test('zero and nothing are level 0', () => {
    expect(intensity(0)).toBe(0)
    expect(intensity(undefined)).toBe(0)
    expect(intensity(null)).toBe(0)
  })

  test('climbs through four filled levels', () => {
    expect(intensity(1)).toBe(1)
    expect(intensity(2)).toBe(2)
    expect(intensity(3)).toBe(2)
    expect(intensity(4)).toBe(3)
    expect(intensity(6)).toBe(3)
    expect(intensity(7)).toBe(4)
    expect(intensity(50)).toBe(4)
  })

  test('thresholds are absolute, so a quiet month cannot recolour a busy one', () => {
    // Same count, same level, regardless of what else is in the data set.
    expect(intensity(1)).toBe(intensity(1))
    expect(intensity(7)).toBe(4)
  })
})

describe('buildGrid', () => {
  test('returns whole Sunday-start weeks', () => {
    const grid = buildGrid([], { weeks: 4, now: NOW, tz: NY })
    expect(grid).toHaveLength(4)
    grid.forEach((week) => expect(week).toHaveLength(7))
    // 2026-08-02 is the Sunday of the week containing Friday 2026-08-07.
    expect(grid[3][0].key).toBe('2026-08-02')
    expect(grid[0][0].key).toBe('2026-07-12')
  })

  test('today lands in the final week and is not marked future', () => {
    const grid = buildGrid([], { weeks: 2, now: NOW, tz: NY })
    const today = grid[1].find((d) => d.key === '2026-08-07')
    expect(today).toBeTruthy()
    expect(today.future).toBe(false)
  })

  test('days after today are future, so an unlived day is not a missed day', () => {
    const grid = buildGrid([], { weeks: 1, now: NOW, tz: NY })
    expect(grid[0].find((d) => d.key === '2026-08-08').future).toBe(true)
    expect(grid[0].find((d) => d.key === '2026-08-06').future).toBe(false)
  })

  test('places counts on the right squares with the right level', () => {
    const rows = [on('2026-08-07'), on('2026-08-07'), on('2026-08-03')]
    const grid = buildGrid(rows, { weeks: 2, now: NOW, tz: NY })
    const flat = grid.flat()
    expect(flat.find((d) => d.key === '2026-08-07')).toMatchObject({ count: 2, level: 2 })
    expect(flat.find((d) => d.key === '2026-08-03')).toMatchObject({ count: 1, level: 1 })
    expect(flat.find((d) => d.key === '2026-08-04')).toMatchObject({ count: 0, level: 0 })
  })

  test('the week boundary follows the zone', () => {
    // In Tokyo the same instant is Saturday the 8th, so that week's Sunday is the 2nd
    // and the grid runs one day further forward.
    const grid = buildGrid([], { weeks: 1, now: NOW, tz: TOKYO })
    expect(grid[0][0].key).toBe('2026-08-02')
    expect(grid[0].find((d) => d.key === '2026-08-08').future).toBe(false)
  })

  test('empty input still produces a full grid', () => {
    const grid = buildGrid(undefined, { weeks: 3, now: NOW, tz: NY })
    expect(grid.flat()).toHaveLength(21)
    expect(totalIn(grid)).toBe(0)
  })
})

describe('currentStreak', () => {
  test('counts consecutive days ending today', () => {
    const rows = [on('2026-08-07'), on('2026-08-06'), on('2026-08-05')]
    expect(currentStreak(rows, { now: NOW, tz: NY })).toBe(3)
  })

  test('a gap ends it', () => {
    const rows = [on('2026-08-07'), on('2026-08-05')]
    expect(currentStreak(rows, { now: NOW, tz: NY })).toBe(1)
  })

  test('yesterday anchors it, so 9am before any work is not a broken streak', () => {
    const rows = [on('2026-08-06'), on('2026-08-05')]
    expect(currentStreak(rows, { now: NOW, tz: NY })).toBe(2)
  })

  test('two days of silence is zero', () => {
    expect(currentStreak([on('2026-08-04')], { now: NOW, tz: NY })).toBe(0)
    expect(currentStreak([], { now: NOW, tz: NY })).toBe(0)
  })

  test('several contributions on one day still count as one day', () => {
    const rows = [on('2026-08-07'), on('2026-08-07'), on('2026-08-07')]
    expect(currentStreak(rows, { now: NOW, tz: NY })).toBe(1)
  })
})

describe('totals', () => {
  const rows = [on('2026-08-07'), on('2026-08-07'), on('2026-08-03')]

  test('totalIn sums every contribution in the window', () => {
    expect(totalIn(buildGrid(rows, { weeks: 2, now: NOW, tz: NY }))).toBe(3)
  })

  test('activeDays counts days, not contributions', () => {
    expect(activeDays(buildGrid(rows, { weeks: 2, now: NOW, tz: NY }))).toBe(2)
  })

  test('both are zero on an empty grid rather than undefined', () => {
    expect(totalIn([])).toBe(0)
    expect(activeDays([])).toBe(0)
  })
})

describe('monthLabels', () => {
  test('labels the week each new month starts in', () => {
    const grid = buildGrid([], { weeks: 8, now: NOW, tz: NY })
    const labels = monthLabels(grid)
    expect(labels.map((l) => l.label)).toContain('Aug')
    expect(labels.every((l) => l.index >= 0 && l.index < 8)).toBe(true)
  })

  test('does not repeat a month', () => {
    const labels = monthLabels(buildGrid([], { weeks: 26, now: NOW, tz: NY }))
    expect(new Set(labels.map((l) => l.label)).size).toBe(labels.length)
  })

  test('empty grid yields no labels', () => {
    expect(monthLabels([])).toEqual([])
  })
})
