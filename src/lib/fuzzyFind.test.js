import { describe, test, expect } from 'vitest'
import { fuzzyFind } from './fuzzyFind.js'

const items = [
  { id: 1, title: 'React hooks guide', note: 'useEffect and useState' },
  { id: 2, title: 'Postgres indexing', note: 'btree and gin' },
  { id: 3, title: 'Rust ownership', note: 'borrow checker' },
]

describe('fuzzyFind', () => {
  test('empty query returns all items unchanged', () => {
    expect(fuzzyFind('', items, ['title'])).toEqual(items)
  })
  test('matches subsequence in title', () => {
    const r = fuzzyFind('rhg', items, ['title'])
    expect(r[0].id).toBe(1)
  })
  test('matches across multiple keys', () => {
    const r = fuzzyFind('borrow', items, ['title', 'note'])
    expect(r.map((x) => x.id)).toContain(3)
  })
  test('excludes non-matches', () => {
    const r = fuzzyFind('xyz', items, ['title'])
    expect(r).toEqual([])
  })
  test('prefix match ranks higher than scattered match', () => {
    const data = [
      { id: 'a', title: 'advanced rust' },
      { id: 'b', title: 'rust basics' },
    ]
    const r = fuzzyFind('rust', data, ['title'])
    expect(r[0].id).toBe('b') // prefix match wins
  })
  test('is case insensitive', () => {
    const r = fuzzyFind('REACT', items, ['title'])
    expect(r[0].id).toBe(1)
  })
})
