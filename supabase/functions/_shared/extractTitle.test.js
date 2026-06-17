import { describe, test, expect } from 'vitest'
import { extractTitle, extractMetadata } from './extractTitle.ts'

describe('extractTitle', () => {
  test('prefers og:title when present', () => {
    const html = '<html><head><meta property="og:title" content="OG Name"><title>Plain</title></head></html>'
    expect(extractTitle(html, 'https://example.com/x')).toEqual({ title: 'OG Name', site: 'example.com' })
  })

  test('falls back to <title>', () => {
    const html = '<html><head><title>Just Title</title></head></html>'
    expect(extractTitle(html, 'https://news.ycombinator.com/item?id=1')).toEqual({
      title: 'Just Title', site: 'news.ycombinator.com',
    })
  })

  test('trims and collapses whitespace in titles', () => {
    const html = '<title>\n  Spaced   Out \n</title>'
    expect(extractTitle(html, 'https://a.com').title).toBe('Spaced Out')
  })

  test('returns null title when none found', () => {
    expect(extractTitle('<html></html>', 'https://a.com')).toEqual({ title: null, site: 'a.com' })
  })

  test('decodes common HTML entities', () => {
    const html = '<title>Tom &amp; Jerry &lt;3</title>'
    expect(extractTitle(html, 'https://a.com').title).toBe('Tom & Jerry <3')
  })
})

describe('extractMetadata', () => {
  test('extracts og:image and description', () => {
    const html = `<html><head>
      <meta property="og:title" content="OG Name">
      <meta property="og:image" content="/cover.jpg">
      <meta property="og:description" content="A short summary">
    </head></html>`
    expect(extractMetadata(html, 'https://example.com/x')).toEqual({
      title: 'OG Name',
      site: 'example.com',
      image: 'https://example.com/cover.jpg',
      description: 'A short summary',
    })
  })
})
