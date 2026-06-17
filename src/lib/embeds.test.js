import { describe, test, expect } from 'vitest'
import { extractEmbedIds, expandEmbedSyntax } from './embeds.js'

const ID = '11111111-1111-1111-1111-111111111111'
const ID2 = '22222222-2222-2222-2222-222222222222'

describe('extractEmbedIds', () => {
  test('pulls unique ids', () => {
    const md = `see [[entry:${ID}]] and [[entry:${ID2}|label]] and [[entry:${ID}]]`
    expect(extractEmbedIds(md)).toEqual([ID, ID2])
  })
  test('empty when none', () => {
    expect(extractEmbedIds('plain text')).toEqual([])
  })
})

describe('expandEmbedSyntax', () => {
  const getTitle = (id) => (id === ID ? 'Real Title' : null)

  test('uses looked-up title when no label', () => {
    expect(expandEmbedSyntax(`x [[entry:${ID}]] y`, getTitle))
      .toBe(`x [Real Title](entry:${ID}) y`)
  })
  test('uses explicit label over title', () => {
    expect(expandEmbedSyntax(`[[entry:${ID}|My Label]]`, getTitle))
      .toBe(`[My Label](entry:${ID})`)
  })
  test('missing entry renders placeholder label', () => {
    expect(expandEmbedSyntax(`[[entry:${ID2}]]`, getTitle))
      .toBe(`[missing entry](entry:${ID2})`)
  })
  test('leaves normal markdown untouched', () => {
    expect(expandEmbedSyntax('[google](https://g.com)', getTitle))
      .toBe('[google](https://g.com)')
  })
})
