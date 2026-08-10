import { describe, test, expect } from 'vitest'
import {
  daysUntil, urgencyOf, phraseFor, buildDeadlines, todayIn,
  HORIZON_DAYS, CLOSED_STATUSES, OPEN_WINDOW_STALE_DAYS,
} from '../../../src/lib/deadlines.js'

const NOW = new Date('2026-08-07T15:00:00Z')
const NY = 'America/New_York'
const TOKYO = 'Asia/Tokyo'

const FRESH = '2026-08-01' // within OPEN_WINDOW_STALE_DAYS of NOW
const program = (over = {}) => ({ id: 'p1', name: 'Neo Scholars', url: 'https://neo.com', deadline: null, category: 'program', window_open: false, last_checked: FRESH, ...over })
const application = (over = {}) => ({ id: 'a1', company: 'Optiver', role: 'Quant Dev Intern', url: null, deadline: null, status: 'saved', ...over })

describe('todayIn', () => {
  test('is the local day, not the UTC one', () => {
    expect(todayIn(NOW, NY)).toBe('2026-08-07')
    expect(todayIn(NOW, TOKYO)).toBe('2026-08-08')
  })
})

describe('daysUntil', () => {
  test('counts calendar days', () => {
    expect(daysUntil('2026-08-07', NOW, NY)).toBe(0)
    expect(daysUntil('2026-08-08', NOW, NY)).toBe(1)
    expect(daysUntil('2026-08-14', NOW, NY)).toBe(7)
  })

  test('is negative for the past', () => {
    expect(daysUntil('2026-08-01', NOW, NY)).toBe(-6)
  })

  test('measures from the local day, so the zone shifts the count', () => {
    expect(daysUntil('2026-08-08', NOW, TOKYO)).toBe(0)
  })

  test('does not drift across a DST boundary', () => {
    // US DST ends 2026-11-01; an hours-based subtraction would round to 24 or 26.
    const oct = new Date('2026-10-30T15:00:00Z')
    expect(daysUntil('2026-11-05', oct, NY)).toBe(6)
  })

  test('accepts a full timestamp, not just a bare date', () => {
    expect(daysUntil('2026-08-10T00:00:00Z', NOW, NY)).toBe(3)
  })

  test('null for junk rather than NaN', () => {
    expect(daysUntil(null, NOW, NY)).toBe(null)
    expect(daysUntil('', NOW, NY)).toBe(null)
    expect(daysUntil('soon', NOW, NY)).toBe(null)
    expect(daysUntil(42, NOW, NY)).toBe(null)
  })
})

describe('urgencyOf', () => {
  test('grades by proximity', () => {
    expect(urgencyOf(0)).toBe('today')
    expect(urgencyOf(-1)).toBe('today')
    expect(urgencyOf(3)).toBe('soon')
    expect(urgencyOf(7)).toBe('soon')
    expect(urgencyOf(8)).toBe('later')
  })

  test('a dateless open window is its own level, never the loudest', () => {
    expect(urgencyOf(null)).toBe('open')
  })
})

describe('phraseFor', () => {
  test('reads as language, not arithmetic', () => {
    expect(phraseFor(0)).toBe('today')
    expect(phraseFor(1)).toBe('tomorrow')
    expect(phraseFor(5)).toBe('in 5 days')
    expect(phraseFor(null)).toBe('open now')
  })

  test('never says overdue — that word belongs to the surface this app rejects', () => {
    expect(phraseFor(-3)).toBe('closed')
    for (const d of [-5, -1, 0, 1, 30, null]) {
      expect(phraseFor(d)).not.toMatch(/overdue|late|behind/i)
    }
  })
})

describe('buildDeadlines', () => {
  test('empty in, empty out', () => {
    expect(buildDeadlines()).toEqual([])
    expect(buildDeadlines({ programs: [], applications: [], now: NOW, tz: NY })).toEqual([])
  })

  test('includes a program with a date inside the horizon', () => {
    const rows = buildDeadlines({ programs: [program({ deadline: '2026-08-20' })], now: NOW, tz: NY })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'program:p1', name: 'Neo Scholars', daysLeft: 13, when: 'in 13 days' })
  })

  test('drops a program beyond the horizon', () => {
    const far = new Date(NOW.getTime() + (HORIZON_DAYS + 5) * 86400000).toISOString().slice(0, 10)
    expect(buildDeadlines({ programs: [program({ deadline: far })], now: NOW, tz: NY })).toEqual([])
  })

  test('drops a program whose date has passed', () => {
    expect(buildDeadlines({ programs: [program({ deadline: '2026-07-01' })], now: NOW, tz: NY })).toEqual([])
  })

  test('a dateless program shows only while its window is flagged open', () => {
    expect(buildDeadlines({ programs: [program()], now: NOW, tz: NY })).toEqual([])
    const open = buildDeadlines({ programs: [program({ window_open: true })], now: NOW, tz: NY })
    expect(open).toHaveLength(1)
    expect(open[0]).toMatchObject({ when: 'open now', daysLeft: null })
  })

  test('includes an application with a live deadline', () => {
    const rows = buildDeadlines({ applications: [application({ deadline: '2026-08-09', status: 'saved' })], now: NOW, tz: NY })
    expect(rows[0]).toMatchObject({ key: 'application:a1', name: 'Optiver', detail: 'Quant Dev Intern', when: 'in 2 days' })
  })

  test('an application with no deadline never appears — a season is not a date', () => {
    // This is the seeded state: 14 firms, all "opens ~Aug 2027", none with a date.
    const firms = Array.from({ length: 14 }, (_, i) => application({ id: `a${i}`, deadline: null }))
    expect(buildDeadlines({ applications: firms, now: NOW, tz: NY })).toEqual([])
  })

  test('decided applications are dropped, whatever their date', () => {
    for (const status of CLOSED_STATUSES) {
      const rows = buildDeadlines({ applications: [application({ deadline: '2026-08-09', status })], now: NOW, tz: NY })
      expect(rows).toEqual([])
    }
  })

  test('live statuses are kept', () => {
    for (const status of ['saved', 'applied', 'screen', 'interview']) {
      const rows = buildDeadlines({ applications: [application({ deadline: '2026-08-09', status })], now: NOW, tz: NY })
      expect(rows).toHaveLength(1)
    }
  })

  test('merges both tables, soonest first, open windows last', () => {
    const rows = buildDeadlines({
      programs: [
        program({ id: 'p1', deadline: '2026-08-20' }),
        program({ id: 'p2', name: '8VC', deadline: null, window_open: true }),
      ],
      applications: [application({ id: 'a1', deadline: '2026-08-09' })],
      now: NOW,
      tz: NY,
    })
    expect(rows.map((r) => r.key)).toEqual(['application:a1', 'program:p1', 'program:p2'])
  })

  test('skips malformed rows instead of throwing', () => {
    const rows = buildDeadlines({
      programs: [null, {}, { deadline: '2026-08-09' }, program({ deadline: '2026-08-09' })],
      applications: [null, {}, { deadline: '2026-08-09' }],
      now: NOW,
      tz: NY,
    })
    expect(rows).toHaveLength(1)
  })

  test('today is included, not treated as already gone', () => {
    const rows = buildDeadlines({ programs: [program({ deadline: '2026-08-07' })], now: NOW, tz: NY })
    expect(rows[0].when).toBe('today')
  })
})


describe('stale open windows — the "open now, forever" bug', () => {
  test('a fresh open window shows', () => {
    const rows = buildDeadlines({ programs: [program({ window_open: true, last_checked: '2026-08-01' })], now: NOW, tz: NY })
    expect(rows).toHaveLength(1)
    expect(rows[0].when).toBe('open now')
  })

  test('an open window nobody has confirmed in a month drops out on its own', () => {
    // The real case: 8VC and Neo Scholars were flagged open on 2026-06-20 and
    // still read "open now" 51 days later, with nothing able to make them stop.
    const rows = buildDeadlines({
      programs: [program({ window_open: true, last_checked: '2026-06-20T23:27:41Z' })],
      now: NOW, tz: NY,
    })
    expect(rows).toEqual([])
  })

  test('the boundary is inclusive', () => {
    const onEdge = new Date(NOW.getTime() - OPEN_WINDOW_STALE_DAYS * 86400000).toISOString().slice(0, 10)
    const dayOver = new Date(NOW.getTime() - (OPEN_WINDOW_STALE_DAYS + 1) * 86400000).toISOString().slice(0, 10)
    expect(buildDeadlines({ programs: [program({ window_open: true, last_checked: onEdge })], now: NOW, tz: NY })).toHaveLength(1)
    expect(buildDeadlines({ programs: [program({ window_open: true, last_checked: dayOver })], now: NOW, tz: NY })).toEqual([])
  })

  test('a window with no last_checked at all is treated as stale, not as fresh', () => {
    // Fail closed. An unverifiable claim that shows forever is the bug.
    expect(buildDeadlines({ programs: [program({ window_open: true, last_checked: null })], now: NOW, tz: NY })).toEqual([])
  })

  test('a DATED program is unaffected by staleness — it has a real end', () => {
    const rows = buildDeadlines({
      programs: [program({ deadline: '2026-08-20', window_open: true, last_checked: '2020-01-01' })],
      now: NOW, tz: NY,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].when).toBe('in 13 days')
  })
})
