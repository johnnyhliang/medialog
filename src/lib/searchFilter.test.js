import { describe, test, expect } from 'vitest'
import { buildSearchFilter } from './searchFilter.js'

describe('buildSearchFilter', () => {
  test('builds an or-filter for a normal query', () => {
    expect(buildSearchFilter('react')).toBe('note.ilike.%react%,title.ilike.%react%')
  })

  test('strips or-filter grammar and LIKE wildcards (injection-safe)', () => {
    expect(buildSearchFilter('a,b(c)*%_"\\')).toBe('note.ilike.%abc%,title.ilike.%abc%')
  })

  test('trims surrounding whitespace', () => {
    expect(buildSearchFilter('  hi  ')).toBe('note.ilike.%hi%,title.ilike.%hi%')
  })
})
