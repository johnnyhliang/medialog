import { describe, test, expect } from 'vitest'
import { isAllowedAttachment, markdownForAttachment } from './storage.js'

describe('isAllowedAttachment', () => {
  test('accepts images and PDFs under limit', () => {
    expect(isAllowedAttachment({ type: 'image/png', size: 1000 })).toBe(true)
    expect(isAllowedAttachment({ type: 'application/pdf', size: 1000 })).toBe(true)
  })

  test('rejects oversized or unknown types', () => {
    expect(isAllowedAttachment({ type: 'image/png', size: 11 * 1024 * 1024 })).toBe(false)
    expect(isAllowedAttachment({ type: 'text/plain', size: 100 })).toBe(false)
  })
})

describe('markdownForAttachment', () => {
  test('images become markdown images', () => {
    expect(markdownForAttachment('https://x/img.png', { name: 'shot.png', type: 'image/png' }))
      .toBe('![shot.png](https://x/img.png)')
  })

  test('pdfs become markdown links', () => {
    expect(markdownForAttachment('https://x/doc.pdf', { name: 'doc.pdf', type: 'application/pdf' }))
      .toBe('[doc.pdf](https://x/doc.pdf)')
  })
})
