import { describe, test, expect } from 'vitest'
import { scoreRun } from './retrievalEval.js'

describe('scoreRun', () => {
  test('counts a query as failed when no expected entry is retrieved', () => {
    const out = scoreRun([{ query: 'q1', retrieved: ['x', 'y'], expected: ['a'] }])
    expect(out.failureRate).toBe(1)
    expect(out.recallAt5).toBe(0)
    expect(out.mrr).toBe(0)
  })

  test('rewards an expected hit and reports its reciprocal rank', () => {
    const out = scoreRun([{ query: 'q1', retrieved: ['x', 'a', 'y'], expected: ['a'] }])
    expect(out.failureRate).toBe(0)
    expect(out.recallAt5).toBe(1)
    expect(out.mrr).toBeCloseTo(0.5) // rank 2 → 1/2
  })

  test('averages across queries', () => {
    const out = scoreRun([
      { query: 'q1', retrieved: ['a'], expected: ['a'] },
      { query: 'q2', retrieved: ['z'], expected: ['b'] },
    ])
    expect(out.failureRate).toBeCloseTo(0.5)
    expect(out.mrr).toBeCloseTo(0.5)
  })

  test('handles an empty run', () => {
    expect(scoreRun([])).toMatchObject({ failureRate: 0, recallAt5: 0, mrr: 0 })
  })
})
