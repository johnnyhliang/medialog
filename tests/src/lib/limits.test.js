import { describe, test, expect } from 'vitest'
import {
  TIER_LIMITS, limitFor, isOverLimit, remaining, formatBytes, describeLimit,
} from '../../../src/lib/limits.js'

describe('limitFor', () => {
  test('reads the tier table', () => {
    expect(limitFor('free', 'feeds')).toBe(10)
    expect(limitFor('paid', 'feeds')).toBe(100)
  })

  test('null means unlimited, and founder is unlimited everywhere', () => {
    for (const key of Object.keys(TIER_LIMITS.founder)) {
      expect(limitFor('founder', key)).toBeNull()
    }
  })

  // Least-privileged default: an unrecognised tier must not become unlimited.
  test('an unknown tier falls back to free, not to unlimited', () => {
    expect(limitFor('enterprise', 'feeds')).toBe(TIER_LIMITS.free.feeds)
    expect(limitFor(undefined, 'feeds')).toBe(TIER_LIMITS.free.feeds)
  })

  // Adding a dimension to the registry must never retroactively restrict a tier
  // that hasn't declared it.
  test('an undeclared key is unlimited rather than zero', () => {
    expect(limitFor('free', 'someFutureDimension')).toBeNull()
    expect(isOverLimit('free', 'someFutureDimension', 1e9)).toBe(false)
  })
})

describe('isOverLimit', () => {
  test('is inclusive, so callers can ask before adding one more', () => {
    expect(isOverLimit('free', 'feeds', 9)).toBe(false)
    expect(isOverLimit('free', 'feeds', 10)).toBe(true)
    expect(isOverLimit('free', 'feeds', 11)).toBe(true)
  })

  test('unlimited never trips', () => {
    expect(isOverLimit('founder', 'storageBytes', Number.MAX_SAFE_INTEGER)).toBe(false)
  })

  test('treats missing current as zero', () => {
    expect(isOverLimit('free', 'feeds', undefined)).toBe(false)
    expect(isOverLimit('free', 'feeds', null)).toBe(false)
  })
})

describe('remaining', () => {
  test('reports headroom and never goes negative', () => {
    expect(remaining('free', 'feeds', 3)).toBe(7)
    expect(remaining('free', 'feeds', 999)).toBe(0)
  })

  test('is null when unlimited', () => {
    expect(remaining('founder', 'feeds', 5)).toBeNull()
  })
})

describe('formatBytes', () => {
  test('scales units', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(500 * 1024 * 1024)).toBe('500 MB')
    expect(formatBytes(10 * 1024 ** 3)).toBe('10 GB')
  })

  test('handles zero and nullish', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(null)).toBe('0 B')
  })
})

describe('describeLimit', () => {
  test('renders each dimension in its own units', () => {
    expect(describeLimit('free', 'storageBytes')).toBe('500 MB')
    expect(describeLimit('free', 'backupIntervalHours')).toBe('every 24h')
    expect(describeLimit('paid', 'backupIntervalHours')).toBe('hourly')
    expect(describeLimit('free', 'feeds')).toBe('10')
    expect(describeLimit('founder', 'storageBytes')).toBe('unlimited')
  })

  // AI limits are intentionally unset until ai_usage has real history — the whole
  // reason metering ships before caps.
  test('AI call limits are unlimited pending real usage data', () => {
    expect(limitFor('free', 'aiCallsPerMonth')).toBeNull()
    expect(describeLimit('free', 'aiCallsPerMonth')).toBe('unlimited')
  })
})
