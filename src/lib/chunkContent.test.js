import { describe, test, expect } from 'vitest'
import { chunkContent } from './chunkContent.js'
import { MIN_WORDS, MAX_WORDS } from './chunkConfig.js'

const words = (n, w = 'word') => Array.from({ length: n }, () => w).join(' ')

describe('chunkContent — markdown', () => {
  test('splits on headings, carrying heading and matching anchor slug', () => {
    const md = `## Order Books\n${words(200)}\n\n## Adverse Selection\n${words(200)}`
    const out = chunkContent(md, { markdown: true })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ heading: 'Order Books', anchor: 'order-books', position: 0 })
    expect(out[1]).toMatchObject({ heading: 'Adverse Selection', anchor: 'adverse-selection', position: 1 })
  })

  test('merges an undersized section forward instead of emitting a tiny chunk', () => {
    const md = `## Tiny\n${words(10)}\n\n## Big\n${words(200)}`
    const out = chunkContent(md, { markdown: true })
    expect(out).toHaveLength(1)
    expect(out[0].content).toContain('Tiny')
    expect(out[0].wordCount).toBeGreaterThanOrEqual(MIN_WORDS)
  })

  test('splits an oversized section into bounded chunks', () => {
    const md = `## Huge\n${words(900)}`
    const out = chunkContent(md, { markdown: true })
    expect(out.length).toBeGreaterThan(1)
    for (const c of out) expect(c.wordCount).toBeLessThanOrEqual(MAX_WORDS)
  })

  test('content with no headings still yields chunks', () => {
    const out = chunkContent(words(300), { markdown: true })
    expect(out.length).toBeGreaterThanOrEqual(1)
  })
})

describe('chunkContent — plain text', () => {
  test('windows with overlap and records ascending charStart', () => {
    const out = chunkContent(words(900), { markdown: false })
    expect(out.length).toBeGreaterThan(1)
    expect(out[0].charStart).toBe(0)
    expect(out[1].charStart).toBeGreaterThan(0)
    for (const c of out) expect(c.wordCount).toBeLessThanOrEqual(MAX_WORDS)
  })

  test('overlaps consecutive windows (last words of A reappear in B)', () => {
    const out = chunkContent(words(900, 'x') + ' ' + words(1, 'BOUNDARY') + ' ' + words(900, 'y'), { markdown: false })
    const joined = out.map((c) => c.content)
    const hits = joined.filter((c) => c.includes('BOUNDARY')).length
    expect(hits).toBeGreaterThanOrEqual(1)
  })

  test('short text yields exactly one chunk at position 0', () => {
    const out = chunkContent('a short note', { markdown: false })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ position: 0, charStart: 0 })
  })

  test('empty or whitespace input yields no chunks', () => {
    expect(chunkContent('', { markdown: false })).toEqual([])
    expect(chunkContent('   \n  ', { markdown: true })).toEqual([])
    expect(chunkContent(null, { markdown: false })).toEqual([])
  })
})
