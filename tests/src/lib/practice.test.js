import { describe, test, expect } from 'vitest'
import {
  CSES, CODEFORCES, CF_STRIDE, csesUrl, codeforcesUrl, dayIndex, staticPicks,
} from '../../../src/lib/practice.js'

describe('the curated lists', () => {
  test('every CSES entry has a numeric id and a title', () => {
    expect(CSES.length).toBeGreaterThan(20)
    for (const p of CSES) {
      expect(Number.isInteger(p.id)).toBe(true)
      expect(p.title.trim()).not.toBe('')
      expect(p.group.trim()).not.toBe('')
    }
  })

  test('no duplicate ids in either list', () => {
    expect(new Set(CSES.map((p) => p.id)).size).toBe(CSES.length)
    expect(new Set(CODEFORCES.map((p) => p.id)).size).toBe(CODEFORCES.length)
  })

  test('every Codeforces id parses into a contest and index', () => {
    for (const p of CODEFORCES) {
      expect(p.id).toMatch(/^\d+[A-Z]\d?$/)
      expect(codeforcesUrl(p.id)).not.toBe('https://codeforces.com/problemset')
      expect(p.rating).toBeGreaterThanOrEqual(1200)
      expect(p.rating).toBeLessThanOrEqual(1700)
    }
  })
})

describe('urls', () => {
  test('cses', () => {
    expect(csesUrl(1068)).toBe('https://cses.fi/problemset/task/1068')
  })

  test('codeforces splits contest from index', () => {
    expect(codeforcesUrl('4C')).toBe('https://codeforces.com/problemset/problem/4/C')
    expect(codeforcesUrl('1520D')).toBe('https://codeforces.com/problemset/problem/1520/D')
    expect(codeforcesUrl('520B')).toBe('https://codeforces.com/problemset/problem/520/B')
  })

  test('a malformed id falls back to the problemset rather than a 404', () => {
    expect(codeforcesUrl('nonsense')).toBe('https://codeforces.com/problemset')
    expect(codeforcesUrl('')).toBe('https://codeforces.com/problemset')
    expect(codeforcesUrl(undefined)).toBe('https://codeforces.com/problemset')
  })
})

describe('dayIndex', () => {
  test('is stable across a whole day and advances at the boundary', () => {
    const morning = new Date('2026-08-08T08:00:00Z')
    const evening = new Date('2026-08-08T22:00:00Z')
    const next = new Date('2026-08-09T08:00:00Z')
    expect(dayIndex(morning, 'UTC')).toBe(dayIndex(evening, 'UTC'))
    expect(dayIndex(next, 'UTC')).toBe(dayIndex(morning, 'UTC') + 1)
  })
})

describe('staticPicks', () => {
  const at = (iso) => staticPicks(new Date(iso), 'UTC')

  test('returns exactly two rows — the card is three with the daily', () => {
    expect(at('2026-08-08T12:00:00Z')).toHaveLength(2)
  })

  test('one cses and one codeforces, each with a real url', () => {
    const [cses, cf] = at('2026-08-08T12:00:00Z')
    expect(cses.source).toBe('cses')
    expect(cses.url).toMatch(/^https:\/\/cses\.fi\/problemset\/task\/\d+$/)
    expect(cf.source).toBe('codeforces')
    expect(cf.url).toMatch(/^https:\/\/codeforces\.com\/problemset\/problem\/\d+\/[A-Z]\d?$/)
  })

  test('the same day always gives the same pair — never re-rolls on re-render', () => {
    expect(at('2026-08-08T00:30:00Z')).toEqual(at('2026-08-08T23:30:00Z'))
  })

  test('consecutive days give different problems', () => {
    const a = at('2026-08-08T12:00:00Z')
    const b = at('2026-08-09T12:00:00Z')
    expect(a[0].url).not.toBe(b[0].url)
    expect(a[1].url).not.toBe(b[1].url)
  })

  test('the codeforces stride is coprime with the list length', () => {
    // The bug this pins: a stride sharing a factor with the length reaches only
    // length/gcd entries. 7 against 14 reached two of fourteen problems forever.
    const gcd = (a, b) => (b ? gcd(b, a % b) : a)
    expect(gcd(CF_STRIDE, CODEFORCES.length)).toBe(1)
  })

  test('every problem in both lists is actually reachable', () => {
    const seenCses = new Set()
    const seenCf = new Set()
    for (let d = 0; d < 1000; d++) {
      const day = new Date(Date.UTC(2026, 7, 8) + d * 86400000)
      const [c, f] = staticPicks(day, 'UTC')
      seenCses.add(c.url)
      seenCf.add(f.url)
    }
    expect(seenCses.size).toBe(CSES.length)
    expect(seenCf.size).toBe(CODEFORCES.length)
  })

  test('the two lists do not advance in lockstep', () => {
    const pairs = new Set()
    for (let d = 0; d < 200; d++) {
      const day = new Date(Date.UTC(2026, 7, 8) + d * 86400000)
      const [c, f] = staticPicks(day, 'UTC')
      pairs.add(`${c.url}|${f.url}`)
    }
    // Coprime strides over 41 and 14 give a period of 574, so 200 consecutive
    // days should be 200 distinct pairings.
    expect(pairs.size).toBe(200)
  })

  test('every day of a long run produces a valid pick — no undefined wraparound', () => {
    for (let d = -400; d < 400; d++) {
      const day = new Date(Date.UTC(2026, 7, 8) + d * 86400000)
      const rows = staticPicks(day, 'UTC')
      expect(rows).toHaveLength(2)
      for (const r of rows) {
        expect(r.title).toBeTruthy()
        expect(r.url).toMatch(/^https:\/\//)
        expect(r.meta).toBeTruthy()
      }
    }
  })
})
