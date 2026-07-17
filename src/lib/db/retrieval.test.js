import { describe, test, expect } from 'vitest'
import { shouldUseTrigram, mmrSelect } from './retrieval.js'

describe('shouldUseTrigram', () => {
  test('engages for short queries (where typos matter)', () => {
    expect(shouldUseTrigram('adverze selection')).toBe(true)
    expect(shouldUseTrigram('vwap')).toBe(true)
  })

  test('does not engage for long queries (trigram is noisy on prose)', () => {
    expect(shouldUseTrigram('why do market makers lose money to informed traders over time')).toBe(false)
  })

  test('does not engage on empty input', () => {
    expect(shouldUseTrigram('')).toBe(false)
    expect(shouldUseTrigram('   ')).toBe(false)
  })
})

describe('mmrSelect', () => {
  test('prefers high score but drops same-topic redundancy', () => {
    const candidates = [
      { id: 'a', score: 0.9, entryId: 'e1', topicId: 't1' },
      { id: 'b', score: 0.89, entryId: 'e2', topicId: 't1' }, // same topic as the winner
      { id: 'c', score: 0.7, entryId: 'e3', topicId: 't2' },  // different topic
    ]
    const out = mmrSelect(candidates, { k: 2, lambda: 0.5 })
    expect(out[0].id).toBe('a')
    expect(out[1].id).toBe('c') // diversity beats the marginally-higher same-topic hit
  })

  test('returns everything when k exceeds the candidate count', () => {
    const candidates = [{ id: 'a', score: 1, entryId: 'e1', topicId: 't1' }]
    expect(mmrSelect(candidates, { k: 5, lambda: 0.5 })).toHaveLength(1)
  })

  test('handles an empty candidate list', () => {
    expect(mmrSelect([], { k: 3, lambda: 0.5 })).toEqual([])
  })
})
