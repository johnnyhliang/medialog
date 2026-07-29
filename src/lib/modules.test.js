import { test, expect, describe } from 'vitest'
import {
  MODULES, GRANDFATHERED_KEY, isEntitled, isEnabled, isModuleVisible,
  listModulesForSettings, tierReaches,
} from './modules.js'

describe('entitlement layer', () => {
  test('tier ordering is free < paid < founder', () => {
    expect(tierReaches('founder', 'paid')).toBe(true)
    expect(tierReaches('paid', 'free')).toBe(true)
    expect(tierReaches('free', 'paid')).toBe(false)
    expect(tierReaches('paid', 'founder')).toBe(false)
  })

  test('an unknown tier is treated as free, not as privileged', () => {
    expect(isEntitled('metrics', 'superadmin')).toBe(false)
    expect(isEntitled('metrics', undefined)).toBe(false)
  })

  test('interview and career are founder-only, never reachable by a paid user', () => {
    for (const id of ['interview', 'career', 'assistant', 'metrics', 'uploads']) {
      expect(isEntitled(id, 'free')).toBe(false)
      expect(isEntitled(id, 'paid')).toBe(false)
      expect(isEntitled(id, 'founder')).toBe(true)
    }
  })

  test('unknown module ids are never visible', () => {
    expect(isEntitled('nope', 'founder')).toBe(false)
    expect(isModuleVisible('nope', { tier: 'founder' })).toBe(false)
  })
})

describe('preference layer', () => {
  test('core modules cannot be turned off', () => {
    expect(isEnabled('home', { home: false })).toBe(true)
    expect(isEnabled('search', { search: false })).toBe(true)
  })

  test('absent keys fall back to the registry default', () => {
    expect(isEnabled('digest', {})).toBe(true)    // defaultOn
    expect(isEnabled('feed', {})).toBe(false)     // opt-in
  })

  test('an explicit preference beats the registry default either way', () => {
    expect(isEnabled('feed', { feed: true })).toBe(true)
    expect(isEnabled('digest', { digest: false })).toBe(false)
  })

  test('grandfathered accounts keep opt-in modules on until explicitly disabled', () => {
    const prefs = { [GRANDFATHERED_KEY]: true }
    expect(isEnabled('feed', prefs)).toBe(true)
    expect(isEnabled('archive', prefs)).toBe(true)
    // An explicit choice still wins over the grandfather sentinel.
    expect(isEnabled('feed', { ...prefs, feed: false })).toBe(false)
  })

  test('a new account (no prefs row) gets the lean default set', () => {
    const on = MODULES.filter((m) => isEnabled(m.id, null)).map((m) => m.id)
    expect(on).toEqual(['home', 'capture', 'topics', 'search', 'settings', 'digest'])
  })
})

describe('composed visibility', () => {
  test('needs both entitlement and preference', () => {
    // Entitled but switched off.
    expect(isModuleVisible('career', { tier: 'founder', prefs: { career: false } })).toBe(false)
    // Switched on but not entitled.
    expect(isModuleVisible('career', { tier: 'free', prefs: { career: true } })).toBe(false)
    // Both.
    expect(isModuleVisible('career', { tier: 'founder', prefs: { career: true } })).toBe(true)
  })

  test('isDev bypasses entitlement but still respects preferences', () => {
    expect(isModuleVisible('metrics', { tier: 'free', prefs: { metrics: true }, isDev: true })).toBe(true)
    expect(isModuleVisible('metrics', { tier: 'free', prefs: { metrics: false }, isDev: true })).toBe(false)
  })
})

describe('settings list', () => {
  test('paid modules show as locked to a free user rather than being hidden', () => {
    const rows = listModulesForSettings({ tier: 'free', prefs: {} })
    const ids = rows.map((r) => r.id)
    expect(ids).toContain('feed')
    // Founder-only internal tools stay hidden entirely — a locked "Metrics" row
    // would advertise an operator surface to every user.
    expect(ids).not.toContain('metrics')
    expect(ids).not.toContain('career')
  })

  test('a founder sees the internal modules', () => {
    const ids = listModulesForSettings({ tier: 'founder', prefs: {} }).map((r) => r.id)
    expect(ids).toContain('metrics')
    expect(ids).toContain('career')
    expect(ids).toContain('interview')
  })
})
