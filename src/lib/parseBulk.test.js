import { describe, test, expect } from 'vitest'
import { parseBulk } from './parseBulk.js'

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
})
