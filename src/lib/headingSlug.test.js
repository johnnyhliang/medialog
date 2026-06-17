import { describe, expect, test } from 'vitest'
import { createHeadingSlugger, headingSlug, parseHeadings } from './headingSlug.js'

describe('headingSlug', () => {
  test('matches GitHub-style punctuation stripping and hyphenation', () => {
    expect(headingSlug('  Résumé: A/B & C#  ')).toBe('resume-a-b-c')
  })

  test('preserves underscores and collapses repeated separators', () => {
    expect(headingSlug('one_two --- three')).toBe('one_two-three')
  })

  test('returns an empty slug for blank input', () => {
    expect(headingSlug('   ')).toBe('')
  })
})

describe('createHeadingSlugger', () => {
  test('adds numeric suffixes for duplicate headings', () => {
    const slug = createHeadingSlugger()
    expect(slug('Heading')).toBe('heading')
    expect(slug('Heading')).toBe('heading-1')
    expect(slug('Heading')).toBe('heading-2')
  })
})

describe('parseHeadings', () => {
  test('extracts ATX headings and ignores fenced code blocks', () => {
    expect(
      parseHeadings([
        '# Alpha',
        '',
        '```md',
        '# not a heading',
        '```',
        '## Alpha',
        '### Beta ###',
      ].join('\n')),
    ).toEqual([
      { depth: 1, text: 'Alpha', slug: 'alpha' },
      { depth: 2, text: 'Alpha', slug: 'alpha-1' },
      { depth: 3, text: 'Beta', slug: 'beta' },
    ])
  })
})
