import { describe, test, expect } from 'vitest'
import { bucketFor, groupAgenda, overdueCount, isAgendaEmpty, BUCKETS } from '../../../src/lib/agenda.js'

// A fixed clock, so these tests mean the same thing in every CI timezone.
// 2026-08-07T15:00:00Z is 11:00 in New York and 00:00 the NEXT day in Tokyo —
// which is what makes it useful for pinning the zone-sensitive cases.
const NOW = new Date('2026-08-07T15:00:00Z')
const NY = 'America/New_York'

const at = (iso) => ({ id: iso, due_at: iso })

describe('bucketFor', () => {
  test('no due date is not on the agenda at all', () => {
    expect(bucketFor(null, NOW, NY)).toBe(null)
    expect(bucketFor(undefined, NOW, NY)).toBe(null)
  })

  test('an unparseable date is dropped rather than thrown on', () => {
    expect(bucketFor('not a date', NOW, NY)).toBe(null)
  })

  test('yesterday is overdue', () => {
    expect(bucketFor('2026-08-06T12:00:00Z', NOW, NY)).toBe('overdue')
  })

  test('tomorrow and six days out are this week', () => {
    expect(bucketFor('2026-08-08T12:00:00Z', NOW, NY)).toBe('week')
    expect(bucketFor('2026-08-13T12:00:00Z', NOW, NY)).toBe('week')
  })

  test('beyond the seven-day window is later', () => {
    expect(bucketFor('2026-09-01T12:00:00Z', NOW, NY)).toBe('later')
  })
})

// The decision recorded in bucketFor's comment: overdue is a question about
// days, not moments. These are the tests that would fail if someone "simplified"
// it back to comparing instants.
describe('end-of-day semantics', () => {
  test('midnight today is Today, not overdue', () => {
    // Local midnight in New York on Aug 7 = 04:00Z. That is 11 hours before
    // NOW, so an instant comparison would call it overdue.
    expect(bucketFor('2026-08-07T04:00:00Z', NOW, NY)).toBe('today')
  })

  test('a time earlier today is still Today', () => {
    // 09:00 New York, two hours before NOW.
    expect(bucketFor('2026-08-07T13:00:00Z', NOW, NY)).toBe('today')
  })

  test('a time later today is Today', () => {
    expect(bucketFor('2026-08-07T22:00:00Z', NOW, NY)).toBe('today')
  })

  test('the last moment of yesterday is overdue', () => {
    // 23:59 New York on Aug 6 = 03:59Z on Aug 7.
    expect(bucketFor('2026-08-07T03:59:00Z', NOW, NY)).toBe('overdue')
  })
})

describe('timezone sensitivity', () => {
  // The bug the timezone work exists to prevent, stated as a test: one instant,
  // two zones, two different buckets.
  // NOW (15:00Z) is 11:00 Aug 7 in New York but already 00:00 Aug 8 in Tokyo —
  // the two zones disagree about what day "today" is, which is the whole point.
  test('the same due date buckets differently per zone', () => {
    const due = '2026-08-08T02:00:00Z' // 22:00 Aug 7 in NY, 11:00 Aug 8 in Tokyo
    expect(bucketFor(due, NOW, NY)).toBe('today')
    expect(bucketFor(due, NOW, 'Asia/Tokyo')).toBe('today')

    // A day later separates them: still inside NY's week, but Tokyo is a day
    // ahead, so its "today" has already moved on.
    const nextDay = '2026-08-09T02:00:00Z' // 22:00 Aug 8 in NY, 11:00 Aug 9 in Tokyo
    expect(bucketFor(nextDay, NOW, NY)).toBe('week')
    expect(bucketFor(nextDay, NOW, 'Asia/Tokyo')).toBe('week')
  })

  test('an override moves the boundary even on the same machine', () => {
    const due = '2026-08-07T04:00:00Z'
    expect(bucketFor(due, NOW, NY)).toBe('today')
    expect(bucketFor(due, NOW, 'Asia/Tokyo')).toBe('overdue')
  })
})

describe('groupAgenda', () => {
  test('splits a mixed list into the four buckets', () => {
    const groups = groupAgenda([
      at('2026-08-01T12:00:00Z'),
      at('2026-08-07T13:00:00Z'),
      at('2026-08-09T12:00:00Z'),
      at('2026-10-01T12:00:00Z'),
    ], NOW, NY)
    expect(groups.overdue.map((e) => e.id)).toEqual(['2026-08-01T12:00:00Z'])
    expect(groups.today.map((e) => e.id)).toEqual(['2026-08-07T13:00:00Z'])
    expect(groups.week.map((e) => e.id)).toEqual(['2026-08-09T12:00:00Z'])
    expect(groups.later.map((e) => e.id)).toEqual(['2026-10-01T12:00:00Z'])
  })

  // Empty buckets are returned on purpose: the UI says "nothing overdue"
  // rather than omitting the section, and closure states need that.
  test('always returns every bucket, even when empty', () => {
    const groups = groupAgenda([], NOW, NY)
    expect(Object.keys(groups).sort()).toEqual([...BUCKETS].sort())
    expect(isAgendaEmpty(groups)).toBe(true)
  })

  test('tolerates null and entries with no due date', () => {
    expect(isAgendaEmpty(groupAgenda(null, NOW, NY))).toBe(true)
    expect(isAgendaEmpty(groupAgenda([{ id: 'x', due_at: null }], NOW, NY))).toBe(true)
  })

  test('preserves the order it was given, which the query sorted', () => {
    const groups = groupAgenda([
      at('2026-08-01T12:00:00Z'),
      at('2026-08-03T12:00:00Z'),
    ], NOW, NY)
    expect(groups.overdue.map((e) => e.id)).toEqual([
      '2026-08-01T12:00:00Z',
      '2026-08-03T12:00:00Z',
    ])
  })
})

describe('overdueCount', () => {
  test('counts only the overdue bucket', () => {
    const entries = [
      at('2026-08-01T12:00:00Z'),
      at('2026-08-02T12:00:00Z'),
      at('2026-08-07T13:00:00Z'),
    ]
    expect(overdueCount(entries, NOW, NY)).toBe(2)
  })

  test('is zero for an empty agenda', () => {
    expect(overdueCount([], NOW, NY)).toBe(0)
  })
})
