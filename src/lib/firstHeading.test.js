import { describe, test, expect } from 'vitest'
import { firstHeading } from './firstHeading.js'

describe('firstHeading', () => {
  test('returns the text of a leading H1', () => {
    expect(firstHeading('# Linear Algebra\nsome notes')).toBe('Linear Algebra')
  })

  test('ignores deeper headings and non-heading first lines', () => {
    expect(firstHeading('## Sub\ntext')).toBeNull()
    expect(firstHeading('just a note')).toBeNull()
  })

  test('skips leading blank lines', () => {
    expect(firstHeading('\n\n# Title')).toBe('Title')
  })

  test('returns null for empty input', () => {
    expect(firstHeading('')).toBeNull()
  })
})
