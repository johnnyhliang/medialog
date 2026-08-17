import { describe, test, expect } from 'vitest'
import { parseBulk } from '../../../src/lib/parseBulk.js'

describe('parseBulk', () => {
  test('splits lines into items, detecting urls', () => {
    const input = 'https://a.com\nsome plain idea\n  https://b.com/x  '
    expect(parseBulk(input)).toEqual([
      { url: 'https://a.com', note: '' },
      { url: null, note: 'some plain idea' },
      { url: 'https://b.com/x', note: '' },
    ])
  })

  test('ignores blank lines', () => {
    expect(parseBulk('https://a.com\n\n\n')).toEqual([{ url: 'https://a.com', note: '' }])
  })

  test('returns empty array for empty input', () => {
    expect(parseBulk('   ')).toEqual([])
  })

  test('captures the reason a link was saved, after any separator', () => {
    const input = [
      'https://a.com — replace my janky rechunk script',
      'https://b.com | the RRF explanation I keep re-googling',
      'https://c.com - watch before the interview',
      'https://d.com :: someday, maybe',
    ].join('\n')
    expect(parseBulk(input)).toEqual([
      { url: 'https://a.com', note: 'replace my janky rechunk script' },
      { url: 'https://b.com', note: 'the RRF explanation I keep re-googling' },
      { url: 'https://c.com', note: 'watch before the interview' },
      { url: 'https://d.com', note: 'someday, maybe' },
    ])
  })

  test('keeps only the first separator, so the reason can contain dashes', () => {
    expect(parseBulk('https://a.com — a tool — for chunking')).toEqual([
      { url: 'https://a.com', note: 'a tool — for chunking' },
    ])
  })

  test('leaves hyphenated urls alone', () => {
    expect(parseBulk('https://a.com/some-long-slug')).toEqual([
      { url: 'https://a.com/some-long-slug', note: '' },
    ])
  })

  test('prose containing a dash stays one note', () => {
    expect(parseBulk('build the thing — then ship it')).toEqual([
      { url: null, note: 'build the thing — then ship it' },
    ])
  })

  test('a url with a separator but no reason is still just a url', () => {
    expect(parseBulk('https://a.com — ')).toEqual([{ url: 'https://a.com', note: '' }])
  })
})
