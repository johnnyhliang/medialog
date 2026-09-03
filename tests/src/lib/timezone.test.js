import { describe, test, expect } from 'vitest'
import {
  BROWSER_DEFAULT,
  isValidTimezone,
  resolveTimezone,
  zonedParts,
  zoneOffsetMs,
  endOfDayIn,
  endOfDayAheadIn,
  isSameDayIn,
  startOfLocalDay,
} from '../../../src/lib/timezone.js'

const HOUR = 3600000

describe('resolveTimezone', () => {
  test('the sentinel and null both defer to the browser', () => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(resolveTimezone(BROWSER_DEFAULT)).toBe(browser)
    expect(resolveTimezone(null)).toBe(browser)
    expect(resolveTimezone('')).toBe(browser)
  })

  test('a valid override wins', () => {
    expect(resolveTimezone('Asia/Tokyo')).toBe('Asia/Tokyo')
  })

  // A zone can be removed between IANA releases. A stale preference must not
  // brick the agenda — falling back is the whole point.
  test('an invalid override falls back rather than throwing', () => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(resolveTimezone('Mars/Olympus_Mons')).toBe(browser)
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false)
  })
})

describe('zonedParts', () => {
  test('reads the wall clock in the target zone, not the machine', () => {
    // 2026-01-15T18:30:00Z is the next morning in Tokyo (UTC+9).
    const p = zonedParts(new Date('2026-01-15T18:30:00Z'), 'Asia/Tokyo')
    expect(p).toMatchObject({ year: 2026, month: 1, day: 16, hour: 3, minute: 30 })
  })

  test('midnight reads as hour 0, not hour 24', () => {
    const p = zonedParts(new Date('2026-01-15T05:00:00Z'), 'America/New_York')
    expect(p.hour).toBe(0)
    expect(p.day).toBe(15)
  })
})

describe('zoneOffsetMs', () => {
  test('is negative west of UTC and positive east', () => {
    const winter = new Date('2026-01-15T12:00:00Z')
    expect(zoneOffsetMs(winter, 'America/New_York')).toBe(-5 * HOUR)
    expect(zoneOffsetMs(winter, 'Asia/Tokyo')).toBe(9 * HOUR)
    expect(zoneOffsetMs(winter, 'UTC')).toBe(0)
  })

  // The reason the offset is computed per-instant instead of per-zone.
  test('tracks DST within the same zone', () => {
    expect(zoneOffsetMs(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-5 * HOUR)
    expect(zoneOffsetMs(new Date('2026-07-15T12:00:00Z'), 'America/New_York')).toBe(-4 * HOUR)
  })

  test('handles a sub-hour offset', () => {
    expect(zoneOffsetMs(new Date('2026-01-15T12:00:00Z'), 'Asia/Kolkata')).toBe(5.5 * HOUR)
  })
})

describe('endOfDayIn', () => {
  test('is the last millisecond of the local day', () => {
    // 19:00 in New York on Jan 15 → end of Jan 15 there is 04:59:59.999Z Jan 16.
    const end = endOfDayIn(new Date('2026-01-16T00:00:00Z'), 'America/New_York')
    expect(end.toISOString()).toBe('2026-01-16T04:59:59.999Z')
  })

  // The bug this whole module exists to prevent: an instant that is still
  // "today" in New York is already tomorrow in UTC.
  test('the same instant yields different day boundaries per zone', () => {
    const now = new Date('2026-01-16T02:00:00Z') // 21:00 Jan 15 in New York
    const ny = endOfDayIn(now, 'America/New_York')
    const utc = endOfDayIn(now, 'UTC')
    expect(ny.toISOString()).toBe('2026-01-16T04:59:59.999Z')
    expect(utc.toISOString()).toBe('2026-01-16T23:59:59.999Z')
    expect(ny.getTime()).toBeLessThan(utc.getTime())
  })

  test('a spring-forward day still ends at local 23:59:59.999', () => {
    // US DST begins 2026-03-08. The day is 23 hours long; the boundary must
    // still land on the local end-of-day, which is where the second pass in
    // instantFromWallClock earns its keep.
    const end = endOfDayIn(new Date('2026-03-08T12:00:00Z'), 'America/New_York')
    expect(end.toISOString()).toBe('2026-03-09T03:59:59.999Z')
    expect(zonedParts(end, 'America/New_York')).toMatchObject({ day: 8, hour: 23, minute: 59 })
  })

  test('a fall-back day still ends at local 23:59:59.999', () => {
    const end = endOfDayIn(new Date('2026-11-01T12:00:00Z'), 'America/New_York')
    expect(zonedParts(end, 'America/New_York')).toMatchObject({ day: 1, hour: 23, minute: 59 })
  })
})

describe('endOfDayAheadIn', () => {
  test('rolls across a month boundary', () => {
    const end = endOfDayAheadIn(new Date('2026-01-28T12:00:00Z'), 'UTC', 7)
    expect(end.toISOString()).toBe('2026-02-04T23:59:59.999Z')
  })

  test('rolls across a year boundary', () => {
    const end = endOfDayAheadIn(new Date('2026-12-30T12:00:00Z'), 'UTC', 7)
    expect(end.toISOString()).toBe('2027-01-06T23:59:59.999Z')
  })

  test('crossing a DST change keeps the local end-of-day', () => {
    const end = endOfDayAheadIn(new Date('2026-03-05T12:00:00Z'), 'America/New_York', 7)
    expect(zonedParts(end, 'America/New_York')).toMatchObject({ month: 3, day: 12, hour: 23 })
  })
})

describe('isSameDayIn', () => {
  test('two instants hours apart can share a local day', () => {
    const a = new Date('2026-01-15T13:00:00Z')
    const b = new Date('2026-01-16T04:00:00Z')
    expect(isSameDayIn(a, b, 'America/New_York')).toBe(true)
    expect(isSameDayIn(a, b, 'UTC')).toBe(false)
  })
})

describe('startOfLocalDay', () => {
  test('lands on the picked day, not the one before it', () => {
    // UTC midnight ('2026-09-11T00:00:00Z') is still Sep 10 in Detroit. That
    // was the shipped snooze bug: a snooze to tomorrow resurfaced tonight.
    const iso = startOfLocalDay('2026-09-11', 'America/Detroit')
    expect(iso).toBe('2026-09-11T04:00:00.000Z')
    expect(new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Detroit' })).toBe('2026-09-11')
  })

  test('uses the offset in effect on the target day, not today', () => {
    // Winter date resolved from a summer `near`: the answer must use EST.
    const iso = startOfLocalDay('2026-12-15', 'America/Detroit', new Date('2026-07-01T12:00:00Z'))
    expect(iso).toBe('2026-12-15T05:00:00.000Z')
  })

  test('rejects anything that is not a bare date', () => {
    expect(startOfLocalDay('', 'UTC')).toBeNull()
    expect(startOfLocalDay('tomorrow', 'UTC')).toBeNull()
  })
})
