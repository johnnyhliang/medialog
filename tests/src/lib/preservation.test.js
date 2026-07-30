import { describe, test, expect } from 'vitest'
import {
  preservationPatch, preservationCoverage, PRESERVED, UNEXTRACTABLE, FAILED,
} from '../../../src/lib/preservation.js'

describe('preservationPatch', () => {
  test('marks ok and carries the text + extractor when text was extracted', () => {
    const patch = preservationPatch({ full_text: 'body text', full_text_extractor: 'readability' })
    expect(patch.full_text).toBe('body text')
    expect(patch.full_text_status).toBe(PRESERVED)
    expect(patch.full_text_extractor).toBe('readability')
    expect(patch.full_text_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('marks empty (not failed) when enrich succeeded but found no body', () => {
    for (const meta of [{ full_text: null }, { full_text: '' }, { full_text: '   ' }, {}]) {
      const patch = preservationPatch(meta)
      expect(patch.full_text_status).toBe(UNEXTRACTABLE)
      // Never write an empty string over an existing full_text.
      expect('full_text' in patch).toBe(false)
    }
  })

  test('marks failed when the enrich call itself failed', () => {
    expect(preservationPatch(null).full_text_status).toBe(FAILED)
    expect(preservationPatch(undefined).full_text_status).toBe(FAILED)
  })
})

describe('preservationCoverage', () => {
  test('counts only non-deleted URL entries', () => {
    const cov = preservationCoverage([
      { url: 'https://a.com', full_text_status: 'ok' },
      { url: 'https://b.com', full_text_status: 'ok' },
      { url: 'https://c.com', full_text_status: 'empty' },
      { url: 'https://d.com', full_text_status: 'failed' },
      { url: 'https://e.com' },
      { url: 'https://f.com', full_text_status: 'ok', deleted_at: '2026-01-01' },
      { note: 'no url here', full_text_status: 'ok' },
    ])
    expect(cov).toEqual({ total: 5, preserved: 2, unextractable: 1, failed: 1, notAttempted: 1, pct: 40 })
  })

  test('handles an empty or missing library without dividing by zero', () => {
    expect(preservationCoverage([]).pct).toBe(0)
    expect(preservationCoverage(undefined).total).toBe(0)
  })
})
