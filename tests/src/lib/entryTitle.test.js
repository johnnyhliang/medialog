import { describe, test, expect } from 'vitest'
import { computeTitle } from '../../../src/lib/entryTitle.js'

describe('computeTitle', () => {
  test('uses first H1 heading', () => {
    expect(computeTitle('# My Heading\n\nbody text', null)).toBe('My Heading')
  })
  test('H1 wins even when not first line', () => {
    expect(computeTitle('\n\n# Real Title\nmore', null)).toBe('Real Title')
  })
  test('falls back to first non-empty line', () => {
    expect(computeTitle('\n\nfirst real line\nsecond', null)).toBe('first real line')
  })
  test('caps first line at 120 chars', () => {
    const long = 'x'.repeat(200)
    expect(computeTitle(long, null)).toBe('x'.repeat(120))
  })
  test('falls back to url when note empty', () => {
    expect(computeTitle('', 'https://example.com/page')).toBe('https://example.com/page')
  })
  test('falls back to url when note whitespace only', () => {
    expect(computeTitle('   \n  ', 'https://example.com')).toBe('https://example.com')
  })
  test('truncates a long url so it cannot breach entry_title_length', () => {
    // Urls may be 2048 chars; titles are capped at 500 by migration 0020, so an
    // untruncated fallback made createEntry throw on long tracking links.
    const longUrl = 'https://x.com/' + 'a'.repeat(900)
    const title = computeTitle('', longUrl)
    expect(title.length).toBe(120)
    expect(longUrl.startsWith(title)).toBe(true)
  })

  test('falls back to Untitled when nothing', () => {
    expect(computeTitle('', null)).toBe('Untitled')
    expect(computeTitle('', '')).toBe('Untitled')
  })
  test('trims heading whitespace', () => {
    expect(computeTitle('#    Spaced Title   ', null)).toBe('Spaced Title')
  })
  test('does not treat ## as H1', () => {
    expect(computeTitle('## Subheading\nbody', null)).toBe('## Subheading')
  })
})
