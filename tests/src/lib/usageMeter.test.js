import { describe, test, expect } from 'vitest'
import {
  meterState, formatResetIn, WARN_AT, AI_WINDOW_HOURS, TIER_LIMITS,
} from '../../../src/lib/limits.js'

// Temporarily give a tier a numeric limit so meter behaviour is testable while
// the real limits are intentionally null (unset pending usage data).
const withLimit = (max) => ({ tier: 'free', used: 0, max })
const state = (used, max, resetsAt = null) => {
  const original = TIER_LIMITS.free.aiCallsPerWindow
  TIER_LIMITS.free.aiCallsPerWindow = max
  try {
    return meterState({ tier: 'free', used, resetsAt })
  } finally {
    TIER_LIMITS.free.aiCallsPerWindow = original
  }
}

describe('meterState', () => {
  // The meter must not render at all when there is no limit — an empty bar is
  // noise, and AI limits ship unset on purpose.
  test('reports unlimited when no limit is configured', () => {
    const m = meterState({ tier: 'free', used: 999 })
    expect(m.unlimited).toBe(true)
    expect(m.level).toBe('ok')
  })

  test('is ok below the warn threshold', () => {
    const m = state(50, 100)
    expect(m.level).toBe('ok')
    expect(m.pct).toBeCloseTo(0.5)
    expect(m.remaining).toBe(50)
  })

  // Warn before the wall: a limit you watched approach is a decision, a limit you
  // discover by hitting it is a bug report.
  test('warns at the threshold, not after it', () => {
    expect(state(Math.ceil(WARN_AT * 100) - 1, 100).level).toBe('ok')
    expect(state(Math.ceil(WARN_AT * 100), 100).level).toBe('warn')
    expect(state(95, 100).level).toBe('warn')
  })

  test('marks exceeded at and beyond the limit', () => {
    expect(state(100, 100).level).toBe('exceeded')
    expect(state(140, 100).level).toBe('exceeded')
  })

  test('clamps the bar so overuse cannot overflow the track', () => {
    expect(state(500, 100).pct).toBe(1)
    expect(state(500, 100).remaining).toBe(0)
  })

  test('carries resetsAt through for the UI', () => {
    const at = new Date().toISOString()
    expect(state(1, 10, at).resetsAt).toBe(at)
  })

  test('a zero limit does not divide by zero', () => {
    const m = state(5, 0)
    expect(Number.isFinite(m.pct)).toBe(true)
    expect(m.level).toBe('exceeded')
  })
})

describe('formatResetIn', () => {
  const now = new Date('2026-07-30T12:00:00Z').getTime()
  const inMin = (m) => new Date(now + m * 60000).toISOString()

  test('renders minutes, then hours', () => {
    expect(formatResetIn(inMin(45), now)).toBe('in 45m')
    expect(formatResetIn(inMin(120), now)).toBe('in 2h')
    expect(formatResetIn(inMin(135), now)).toBe('in 2h 15m')
  })

  test('a past or present reset reads as now, never as negative time', () => {
    expect(formatResetIn(inMin(-30), now)).toBe('now')
    expect(formatResetIn(new Date(now).toISOString(), now)).toBe('now')
  })

  test('returns null when there is nothing to report', () => {
    expect(formatResetIn(null)).toBeNull()
    expect(formatResetIn(undefined)).toBeNull()
  })

  test('handles a malformed timestamp without throwing', () => {
    expect(formatResetIn('not-a-date', now)).toBe('now')
  })
})

describe('window configuration', () => {
  // A short rolling window is the point: capacity returns continuously, so
  // "wait a bit" is always a true answer. A monthly cap can only offer a date.
  test('the window is short enough that exhausting it is recoverable same-day', () => {
    expect(AI_WINDOW_HOURS).toBeGreaterThan(0)
    expect(AI_WINDOW_HOURS).toBeLessThanOrEqual(24)
  })

  test('warns before the wall, not at it', () => {
    expect(WARN_AT).toBeGreaterThan(0.5)
    expect(WARN_AT).toBeLessThan(1)
  })
})
