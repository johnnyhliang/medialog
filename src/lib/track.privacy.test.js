// ============================================================================
// DO NOT DELETE OR WEAKEN THIS FILE.
//
// MediaLog is a personal knowledge base. Note text, entry titles, URLs and
// search queries must never reach the `events` table — an analytics row that
// contains what a user wrote is a betrayal of the product's premise, and counts
// and enums answer every question we actually ask of the data.
//
// These tests are the enforcement point. They assert that every declared event
// accepts ONLY counts and enums, and that anything else a call site passes is
// stripped before it can be inserted. If a new event needs a free-text prop,
// the answer is no: pick an enum.
// ============================================================================
import { describe, it, expect, vi } from 'vitest'
import { track, flushEvents, sanitizeProps, EVENT_SCHEMA } from './track.js'

const EXPECTED_EVENTS = ['entry_created', 'inbox_sorted', 'search_run', 'digest_opened', 'topic_created']

describe('event props are counts and enums only', () => {
  it('declares exactly the agreed event surface', () => {
    expect(Object.keys(EVENT_SCHEMA).sort()).toEqual([...EXPECTED_EVENTS].sort())
  })

  it('declares every prop as either a bounded enum or a numeric count', () => {
    for (const [name, spec] of Object.entries(EVENT_SCHEMA)) {
      for (const [key, rule] of Object.entries(spec)) {
        const kinds = Object.keys(rule)
        expect(kinds, `${name}.${key}`).toHaveLength(1)
        expect(['enum', 'count'], `${name}.${key}`).toContain(kinds[0])
        if (rule.enum) {
          expect(Array.isArray(rule.enum) && rule.enum.length > 0).toBe(true)
          // A short closed set — an "enum" with dozens of members is free text
          // wearing a costume.
          expect(rule.enum.length).toBeLessThanOrEqual(8)
        }
      }
    }
  })

  it('strips any prop not declared in the schema', () => {
    for (const name of EXPECTED_EVENTS) {
      const dirty = {
        note: 'my private note',
        title: 'How to leak data',
        url: 'https://example.com/secret',
        query: 'therapist near me',
        text: 'body text',
      }
      const safe = sanitizeProps(name, dirty)
      for (const key of Object.keys(safe)) {
        expect(EVENT_SCHEMA[name], `${name}.${key}`).toHaveProperty(key)
      }
      expect(JSON.stringify(safe)).not.toMatch(/private|leak|secret|therapist|body text/i)
    }
  })

  it('rejects free text supplied where an enum is expected', () => {
    expect(sanitizeProps('search_run', { mode: 'therapist near me' })).toEqual({})
    expect(sanitizeProps('entry_created', { source: 'https://example.com' })).toEqual({})
  })

  it('coerces counts to non-negative integers and drops non-numbers', () => {
    expect(sanitizeProps('inbox_sorted', { count: 3.7 })).toEqual({ count: 3 })
    expect(sanitizeProps('inbox_sorted', { count: -1 })).toEqual({})
    expect(sanitizeProps('inbox_sorted', { count: 'twelve entries about grief' })).toEqual({})
  })

  it('inserts only sanitized props, whatever the call site passes', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }))
    const sb = { from: () => ({ insert }) }
    track(sb, 'search_run', { mode: 'semantic', query: 'my private query' })
    track(sb, 'inbox_sorted', { count: 4, titles: ['a', 'b'] })
    await flushEvents()
    const rows = insert.mock.calls[0][0]
    expect(rows).toEqual([
      { name: 'search_run', props: { mode: 'semantic' } },
      { name: 'inbox_sorted', props: { count: 4 } },
    ])
  })
})
