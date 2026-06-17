import { describe, test, expect } from 'vitest'
import { filterCandidates } from './entryAutocomplete.js'

const cands = [
  { id: '1', title: 'React hooks', topicId: 'tA', topicName: 'Frontend' },
  { id: '2', title: 'Rust basics', topicId: 'tB', topicName: 'Systems' },
  { id: '3', title: 'Redux guide', topicId: 'tA', topicName: 'Frontend' },
]

describe('filterCandidates', () => {
  test('topic scope keeps only current topic', () => {
    const r = filterCandidates('', cands, { scope: 'topic', currentTopicId: 'tA' })
    expect(r.map((c) => c.id).sort()).toEqual(['1', '3'])
  })
  test('all scope keeps everything', () => {
    const r = filterCandidates('', cands, { scope: 'all', currentTopicId: 'tA' })
    expect(r.length).toBe(3)
  })
  test('fuzzy filters by query within scope', () => {
    const r = filterCandidates('red', cands, { scope: 'all', currentTopicId: 'tA' })
    expect(r[0].id).toBe('3') // Redux prefix
  })
})
