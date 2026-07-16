import { describe, test, expect } from 'vitest'
import { extractHeadings } from './markdownOutline.js'

describe('extractHeadings', () => {
  test('extracts headings with level and matching slug', () => {
    const out = extractHeadings('# Hello World\n\ntext\n\n## Sub Section')
    expect(out).toEqual([
      { level: 1, text: 'Hello World', slug: 'hello-world' },
      { level: 2, text: 'Sub Section', slug: 'sub-section' },
    ])
  })

  test('de-dupes repeated headings the way github-slugger does', () => {
    const out = extractHeadings('## A\n## A')
    expect(out.map((h) => h.slug)).toEqual(['a', 'a-1'])
  })

  test('strips inline markdown from heading text and slug', () => {
    const [h] = extractHeadings('### **Adverse** `selection` [link](http://x)')
    expect(h.text).toBe('Adverse selection link')
    expect(h.slug).toBe('adverse-selection-link')
  })

  test('ignores headings inside fenced code blocks', () => {
    const out = extractHeadings('# Real\n```\n# not a heading\n```\n## Also Real')
    expect(out.map((h) => h.text)).toEqual(['Real', 'Also Real'])
  })

  test('returns empty for no headings or empty input', () => {
    expect(extractHeadings('just a paragraph')).toEqual([])
    expect(extractHeadings('')).toEqual([])
    expect(extractHeadings(null)).toEqual([])
  })
})
