import { describe, test, expect } from 'vitest'
import { parseCurriculum } from './parseCurriculum.js'
import { patternReadiness, trackReadiness } from './db/interview.js'

describe('parseCurriculum', () => {
  test('parses patterns with tracks, target, and problems', () => {
    const out = parseCurriculum(`
## Sliding Window [swe, quant-dev] (3)
- Longest Substring | https://leetcode.com/problems/x/ | medium
- No URL prompt | | hard
## Order Books [qt]
- Explain the book
`)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ name: 'Sliding Window', tracks: ['swe', 'quant-dev'], target: 3 })
    expect(out[0].problems[0]).toEqual({ title: 'Longest Substring', url: 'https://leetcode.com/problems/x/', difficulty: 'medium' })
    expect(out[0].problems[1].url).toBeNull()
    // target defaults to problem count when omitted
    expect(out[1]).toMatchObject({ name: 'Order Books', tracks: ['qt'], target: 1 })
  })

  test('ignores problems before the first header and bad difficulty', () => {
    const out = parseCurriculum(`- orphan\n## P\n- t | | wat`)
    expect(out).toHaveLength(1)
    expect(out[0].problems[0].difficulty).toBeNull()
  })
})

describe('readiness math', () => {
  const pattern = { pattern_target: 4, tracks: ['swe'] }

  test('coverage caps at 1 and multiplies by mastery', () => {
    const problems = [
      { status: 'done', confidence: 5 },
      { status: 'done', confidence: 3 },
      { status: 'active', confidence: null },
    ]
    const r = patternReadiness(pattern, problems)
    expect(r.solved).toBe(2)
    expect(r.coverage).toBeCloseTo(0.5)
    expect(r.mastery).toBeCloseTo(0.8) // (5/5 + 3/5)/2
    expect(r.ready).toBeCloseTo(0.4)
  })

  test('zero solved yields zero readiness', () => {
    expect(patternReadiness(pattern, [{ status: 'backlog' }]).ready).toBe(0)
  })

  test('derives mastery from srs_ef when confidence missing', () => {
    const r = patternReadiness({ pattern_target: 1 }, [{ status: 'done', confidence: null, srs_ef: 2.8 }])
    expect(r.mastery).toBeGreaterThan(0.5)
  })

  test('trackReadiness averages patterns across a track', () => {
    const patterns = [
      { id: 'a', pattern_target: 2, tracks: ['swe'] },
      { id: 'b', pattern_target: 2, tracks: ['swe', 'qt'] },
    ]
    const problemsByTopic = {
      a: [{ status: 'done', confidence: 4 }, { status: 'done', confidence: 4 }], // cov 1 × 0.8
      b: [{ status: 'backlog' }], // 0
    }
    const out = trackReadiness(patterns, problemsByTopic)
    expect(out.swe).toBeCloseTo(0.4) // (0.8 + 0)/2
    expect(out.qt).toBeCloseTo(0) // only pattern b
  })
})
