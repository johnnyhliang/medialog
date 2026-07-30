import { describe, test, expect } from 'vitest'
import { randomSlug } from '../../../src/lib/slug.js'

describe('randomSlug', () => {
  test('default length 16, base62 only', () => {
    const s = randomSlug()
    expect(s).toHaveLength(16)
    expect(s).toMatch(/^[A-Za-z0-9]+$/)
  })

  test('respects a custom length', () => {
    expect(randomSlug(24)).toHaveLength(24)
  })

  test('is effectively unique across many draws', () => {
    const seen = new Set(Array.from({ length: 500 }, () => randomSlug()))
    expect(seen.size).toBe(500)
  })
})
