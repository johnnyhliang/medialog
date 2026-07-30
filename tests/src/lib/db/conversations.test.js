import { describe, test, expect } from 'vitest'
import { titleFromQuestion } from '../../../../src/lib/db/conversations.js'

describe('titleFromQuestion', () => {
  test('trims and collapses whitespace', () => {
    expect(titleFromQuestion('  what   did  I   learn ')).toBe('what did I learn')
  })

  test('falls back to "New chat" for empty input', () => {
    expect(titleFromQuestion('')).toBe('New chat')
    expect(titleFromQuestion('   ')).toBe('New chat')
    expect(titleFromQuestion(null)).toBe('New chat')
  })

  test('truncates long questions with an ellipsis', () => {
    const long = 'a'.repeat(120)
    const out = titleFromQuestion(long)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(81)
  })
})
