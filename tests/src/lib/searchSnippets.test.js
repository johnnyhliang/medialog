import { expect, test } from 'vitest'
import { buildSearchPreview, entryMatchesLiteral, splitHighlightParts } from '../../../src/lib/searchSnippets.js'

const entry = {
  title: 'React rendering notes',
  url: 'https://example.com/react',
  note: 'A long note about memoization and render timing.',
  tags: ['frontend'],
}

test('entryMatchesLiteral uses exact case-insensitive substring matching', () => {
  expect(entryMatchesLiteral(entry, 'render')).toBe(true)
  expect(entryMatchesLiteral(entry, 'rrn')).toBe(false)
})

test('buildSearchPreview returns title and body context', () => {
  const preview = buildSearchPreview(entry, 'render')
  expect(preview.titleMatches).toBe(true)
  expect(preview.snippets.map((s) => s.field)).toContain('note')
})

test('splitHighlightParts marks every literal match', () => {
  expect(splitHighlightParts('React and react', 'react')).toEqual([
    { text: 'React', match: true },
    { text: ' and ', match: false },
    { text: 'react', match: true },
  ])
})
