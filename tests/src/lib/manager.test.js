import { describe, test, expect } from 'vitest'
import {
  momentumFor, progressFor, buildResumeCards, splitCards, buildManager, relativeDays,
  WARM_DAYS, COOLING_DAYS,
} from '../../../src/lib/manager.js'

const DAY = 86400000
const NOW = new Date('2026-08-07T12:00:00.000Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY).toISOString()

describe('momentumFor', () => {
  test('fresh activity is warm', () => {
    expect(momentumFor(daysAgo(0), NOW)).toBe('warm')
    expect(momentumFor(daysAgo(3), NOW)).toBe('warm')
  })

  test('the boundaries land on the colder side', () => {
    // Exactly 7 days is no longer "this week".
    expect(momentumFor(daysAgo(WARM_DAYS - 0.01), NOW)).toBe('warm')
    expect(momentumFor(daysAgo(WARM_DAYS), NOW)).toBe('cooling')
    expect(momentumFor(daysAgo(COOLING_DAYS - 0.01), NOW)).toBe('cooling')
    expect(momentumFor(daysAgo(COOLING_DAYS), NOW)).toBe('cold')
  })

  test('no timestamp, or a junk one, is cold rather than warm', () => {
    expect(momentumFor(null, NOW)).toBe('cold')
    expect(momentumFor(undefined, NOW)).toBe('cold')
    expect(momentumFor('not a date', NOW)).toBe('cold')
  })

  test('accepts a Date as well as an ISO string', () => {
    expect(momentumFor(new Date(NOW.getTime() - DAY), NOW)).toBe('warm')
  })
})

describe('progressFor', () => {
  test('a doc with checkboxes reports steps done over total', () => {
    const p = progressFor('- [x] one\n- [ ] two\n- [ ] three', NOW)
    expect(p).toEqual(expect.objectContaining({ total: 3, done: 1 }))
    expect(p.stepPct).toBeCloseTo(1 / 3)
  })

  test('a plan behind its own target gets the behind flag', () => {
    const doc = [
      '---',
      'started: 2026-01-01',
      'target: 2026-12-31',
      '---',
      '',
      '- [ ] a',
      '- [ ] b',
    ].join('\n')
    const p = progressFor(doc, new Date('2026-11-01T00:00:00.000Z'))
    expect(p.behind).toBe(true)
  })

  test('a plan with no dates is never "behind" — unknown is not late', () => {
    const p = progressFor('- [ ] a\n- [ ] b', NOW)
    expect(p.behind).toBe(false)
    expect(p.timePct).toBeNull()
  })

  test('degrades to null rather than throwing on docs with no plan', () => {
    expect(progressFor('', NOW)).toBeNull()
    expect(progressFor(null, NOW)).toBeNull()
    expect(progressFor(undefined, NOW)).toBeNull()
    expect(progressFor('just some prose about basketball', NOW)).toBeNull()
    // Frontmatter but no checkboxes is still no plan.
    expect(progressFor('---\ntarget: 2026-09-01\n---\n\nnotes', NOW)).toBeNull()
    // Malformed frontmatter must not throw either.
    expect(() => progressFor('---\nnope\n', NOW)).not.toThrow()
  })
})

describe('buildResumeCards', () => {
  const topics = [
    { id: 'inbox', name: 'Inbox' },
    { id: 't1', name: 'Systems Design', master_doc: '- [x] a\n- [ ] b', updated_at: daysAgo(100) },
    { id: 't2', name: 'Basketball', master_doc: 'no plan here', updated_at: daysAgo(100) },
    { id: 't3', name: 'Empty', updated_at: daysAgo(2) },
    { id: 't4', name: 'Archived', archived_at: daysAgo(1) },
  ]
  const entries = [
    { topic_id: 't1', status: 'active', updated_at: daysAgo(3) },
    { topic_id: 't1', status: 'active', updated_at: daysAgo(40) },
    { topic_id: 't1', status: 'backlog', updated_at: daysAgo(40) },
    { topic_id: 't1', status: 'done', updated_at: daysAgo(60) },
    { topic_id: 't2', status: 'backlog', updated_at: daysAgo(45) },
    { topic_id: 'inbox', status: 'active', updated_at: daysAgo(1) },
  ]

  test('the Inbox topic never gets a resume card', () => {
    const cards = buildResumeCards({ topics, entries, states: [], now: NOW })
    expect(cards.map((c) => c.topicId)).not.toContain('inbox')
  })

  test('archived topics are left out', () => {
    const cards = buildResumeCards({ topics, entries, states: [], now: NOW })
    expect(cards.map((c) => c.topicId)).not.toContain('t4')
  })

  test('counts and last-touch come from the entries, not from any stored field', () => {
    const cards = buildResumeCards({ topics, entries, states: [], now: NOW })
    const t1 = cards.find((c) => c.topicId === 't1')
    expect(t1.activeCount).toBe(2)
    expect(t1.backlogCount).toBe(1) // 'done' counts as neither
    expect(t1.momentum).toBe('warm') // newest entry is 3d old
    expect(t1.progress).toEqual(expect.objectContaining({ total: 2, done: 1 }))
  })

  test('a topic whose doc has no checkboxes has null progress', () => {
    const cards = buildResumeCards({ topics, entries, states: [], now: NOW })
    expect(cards.find((c) => c.topicId === 't2').progress).toBeNull()
    expect(cards.find((c) => c.topicId === 't3').progress).toBeNull()
  })

  test('a topic with no entries falls back to its own timestamp', () => {
    const cards = buildResumeCards({ topics, entries, states: [], now: NOW })
    const t3 = cards.find((c) => c.topicId === 't3')
    expect(t3.momentum).toBe('warm')
    expect(t3.activeCount).toBe(0)
  })

  test('stored state supplies next action and parked flags only', () => {
    const states = [
      { topic_id: 't1', next_action: 'finish ch. 5 notes' },
      { topic_id: 't2', parked_at: daysAgo(1), parked_note: 'waiting on the season' },
    ]
    const cards = buildResumeCards({ topics, entries, states, now: NOW })
    expect(cards.find((c) => c.topicId === 't1').nextAction).toBe('finish ch. 5 notes')
    expect(cards.find((c) => c.topicId === 't1').parked).toBe(false)
    const t2 = cards.find((c) => c.topicId === 't2')
    expect(t2.parked).toBe(true)
    expect(t2.parkedNote).toBe('waiting on the season')
  })

  test('empty input does not throw', () => {
    expect(buildResumeCards()).toEqual([])
    expect(buildResumeCards({ topics: null, entries: null, states: null })).toEqual([])
  })
})

describe('splitCards', () => {
  const cards = [
    { topicId: 'warm', momentum: 'warm', lastTouchedAt: daysAgo(1), parked: false },
    { topicId: 'cool', momentum: 'cooling', lastTouchedAt: daysAgo(10), parked: false },
    { topicId: 'cold-a', momentum: 'cold', lastTouchedAt: daysAgo(40), parked: false },
    { topicId: 'cold-b', momentum: 'cold', lastTouchedAt: daysAgo(200), parked: false },
    { topicId: 'shelved', momentum: 'cold', lastTouchedAt: daysAgo(90), parked: true, parkedAt: daysAgo(2) },
  ]

  test('coldest first, then stalest within a band', () => {
    const { active } = splitCards(cards)
    expect(active.map((c) => c.topicId)).toEqual(['cold-b', 'cold-a', 'cool', 'warm'])
  })

  test('parked topics are pulled out of the main list but not dropped', () => {
    const { active, parked } = splitCards(cards)
    expect(active.map((c) => c.topicId)).not.toContain('shelved')
    expect(parked.map((c) => c.topicId)).toEqual(['shelved'])
  })

  test('buildManager returns the cards and the split together', () => {
    const out = buildManager({
      topics: [{ id: 't1', name: 'A', updated_at: daysAgo(50) }],
      entries: [],
      states: [{ topic_id: 't1', parked_at: daysAgo(1), parked_note: 'later' }],
      now: NOW,
    })
    expect(out.cards).toHaveLength(1)
    expect(out.active).toHaveLength(0)
    expect(out.parked).toHaveLength(1)
  })
})

describe('relativeDays', () => {
  test('reads as a human would say it', () => {
    expect(relativeDays(daysAgo(0), NOW)).toBe('today')
    expect(relativeDays(daysAgo(1), NOW)).toBe('yesterday')
    expect(relativeDays(daysAgo(3), NOW)).toBe('3d ago')
    expect(relativeDays(daysAgo(60), NOW)).toBe('2mo ago')
    expect(relativeDays(daysAgo(800), NOW)).toBe('2y ago')
    expect(relativeDays(null, NOW)).toBe('never touched')
  })
})
