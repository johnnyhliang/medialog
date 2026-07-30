import { test, expect, describe } from 'vitest'
import { normalizeCategory, existingCategories, resolveCategory, UNCATEGORIZED } from '../../../src/lib/feedCategories.js'

const feeds = [
  { category: 'writers' },
  { category: 'tech news' },
  { category: null },
  { category: '  ' },
]

describe('normalizeCategory', () => {
  test('trims and collapses whitespace', () => {
    expect(normalizeCategory('  writers ')).toBe('writers')
    expect(normalizeCategory('tech   news')).toBe('tech news')
  })

  test('blank becomes null rather than an empty-string category', () => {
    expect(normalizeCategory('   ')).toBeNull()
    expect(normalizeCategory('')).toBeNull()
    expect(normalizeCategory(undefined)).toBeNull()
  })
})

describe('existingCategories', () => {
  test('lists distinct categories, skipping blanks', () => {
    expect(existingCategories(feeds)).toEqual(['tech news', 'writers'])
  })

  test('never offers two spellings of the same category', () => {
    const dupes = [{ category: 'Writers' }, { category: 'writers' }, { category: 'WRITERS' }]
    expect(existingCategories(dupes)).toEqual(['Writers'])
  })
})

describe('resolveCategory', () => {
  // This is the actual bug: typing "Writers" created a second sidebar group
  // next to "writers", because grouping is an exact string match.
  test('reuses the existing spelling on a case-insensitive match', () => {
    expect(resolveCategory('Writers', feeds)).toBe('writers')
    expect(resolveCategory('  WRITERS  ', feeds)).toBe('writers')
    expect(resolveCategory('Tech News', feeds)).toBe('tech news')
  })

  test('keeps a genuinely new category as typed', () => {
    expect(resolveCategory('Papers', feeds)).toBe('Papers')
  })

  test('blank resolves to null so the feed lands in uncategorized', () => {
    expect(resolveCategory('', feeds)).toBeNull()
    expect(UNCATEGORIZED).toBe('uncategorized')
  })
})
