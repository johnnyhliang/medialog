import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { timeAgo, shortAge } from '../../../src/lib/timeFormat.js'

// Fixed clock: these functions read Date.now(), so every boundary assertion
// below is meaningless without one.
const NOW = new Date('2026-08-24T12:00:00.000Z')
const ago = (ms) => new Date(NOW.getTime() - ms)

const MIN = 60000
const HOUR = 3600000
const DAY = 86400000

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers() })

describe('timeAgo — prose form', () => {
  test.each([
    [0, 'just now'],
    [30 * 1000, 'just now'],
    [MIN, '1m ago'],
    [59 * MIN, '59m ago'],
    [HOUR, '1h ago'],
    [23 * HOUR, '23h ago'],
    [DAY, '1d ago'],
    [6 * DAY, '6d ago'],
    [7 * DAY, '1w ago'],
    [29 * DAY, '4w ago'],
    [30 * DAY, '1mo ago'],
    // 364/30 floors to 12, so '12mo' sits just before the year boundary. A
    // consequence of approximating a month as 30 days; harmless and honest.
    [364 * DAY, '12mo ago'],
    [365 * DAY, '1y ago'],
    [800 * DAY, '2y ago'],
  ])('%i ms → %s', (ms, expected) => {
    expect(timeAgo(ago(ms))).toBe(expected)
  })
})

describe('shortAge — compact form', () => {
  test.each([
    [0, 'just now'],
    [MIN, '1m'],
    [HOUR, '1h'],
    [DAY, '1d'],
    [7 * DAY, '1w'],
    [30 * DAY, '1mo'],
    [365 * DAY, '1y'],
  ])('%i ms → %s', (ms, expected) => {
    expect(shortAge(ago(ms))).toBe(expected)
  })

  // The two deliberate behaviour changes from the old formatAge copies.
  test('under a minute reads "just now", not the old "0m"', () => {
    expect(shortAge(ago(30 * 1000))).toBe('just now')
    expect(shortAge(ago(30 * 1000))).not.toBe('0m')
  })

  test('past a year reads "1y", not the old three-digit day count', () => {
    expect(shortAge(ago(400 * DAY))).toBe('1y')
    expect(shortAge(ago(400 * DAY))).not.toBe('400d')
  })
})

describe('input handling — the four ways the old copies disagreed', () => {
  test('accepts both a Date and a string', () => {
    expect(shortAge(ago(HOUR))).toBe('1h')
    expect(shortAge(ago(HOUR).toISOString())).toBe('1h')
    expect(timeAgo(ago(HOUR).toISOString())).toBe('1h ago')
  })

  test.each([null, undefined, ''])('returns null for %p rather than throwing or returning ""', (v) => {
    expect(timeAgo(v)).toBeNull()
    expect(shortAge(v)).toBeNull()
  })

  test('returns null for an unparseable date instead of NaN output', () => {
    expect(shortAge('not a date')).toBeNull()
    expect(timeAgo('not a date')).toBeNull()
  })

  // Only one of the five old copies clamped. The rest rendered "-3m" on a
  // clock-skewed timestamp.
  test('a future date clamps to "just now" rather than going negative', () => {
    const future = new Date(NOW.getTime() + 3 * MIN)
    expect(shortAge(future)).toBe('just now')
    expect(timeAgo(future)).toBe('just now')
  })
})
