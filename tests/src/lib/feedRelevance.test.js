import { describe, test, expect } from 'vitest'
import { tokenize, buildInterestProfile, scoreItem, sortByRelevance } from '../../../src/lib/feedRelevance.js'

describe('feedRelevance', () => {
  test('tokenize drops stopwords and short tokens, keeps + and #', () => {
    expect(tokenize('The C++ and Rust guide')).toEqual(['c++', 'rust', 'guide'])
  })

  test('buildInterestProfile skips Inbox and pulls from topics + tags', () => {
    const p = buildInterestProfile({
      topics: [{ name: 'Machine Learning' }, { name: 'Inbox' }],
      tags: ['rust', { name: 'guitar' }],
    })
    expect(p.has('machine')).toBe(true)
    expect(p.has('learning')).toBe(true)
    expect(p.has('rust')).toBe(true)
    expect(p.has('guitar')).toBe(true)
    expect(p.has('inbox')).toBe(false)
  })

  test('title tokens only enter the profile when they recur (>=2 titles)', () => {
    const p = buildInterestProfile({
      topics: [],
      tags: [],
      titles: ['Kubernetes networking deep dive', 'Kubernetes operators', 'one-off headline'],
    })
    expect(p.has('kubernetes')).toBe(true) // appears in 2 titles
    expect(p.has('networking')).toBe(false) // only 1 title
    expect(p.has('headline')).toBe(false)
  })

  test('scoreItem weighs title matches double', () => {
    const profile = new Set(['rust', 'compiler'])
    expect(scoreItem({ title: 'Rust compiler internals', summary: '' }, profile)).toBe(4)
    expect(scoreItem({ title: 'Cooking', summary: 'a rust pan' }, profile)).toBe(1)
    expect(scoreItem({ title: 'Cooking', summary: 'nothing here' }, profile)).toBe(0)
  })

  test('empty profile scores zero', () => {
    expect(scoreItem({ title: 'Rust' }, new Set())).toBe(0)
  })

  test('sortByRelevance ranks by score then recency', () => {
    const profile = new Set(['rust'])
    const items = [
      { id: 'a', title: 'nothing', published_at: '2026-01-02T00:00:00Z' },
      { id: 'b', title: 'rust guide', published_at: '2026-01-01T00:00:00Z' },
      { id: 'c', title: 'rust news', published_at: '2026-01-03T00:00:00Z' },
    ]
    const out = sortByRelevance(items, profile)
    expect(out.map((i) => i.id)).toEqual(['c', 'b', 'a'])
    expect(out[0]._relevance).toBe(2)
  })
})
