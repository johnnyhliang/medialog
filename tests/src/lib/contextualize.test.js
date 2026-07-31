import { describe, test, expect, vi, beforeEach } from 'vitest'
import { contextualizeChunks } from '../../../src/lib/contextualize.js'

vi.mock('../../../src/lib/ai.js', async () => {
  const actual = await vi.importActual('../../../src/lib/ai.js')
  return { ...actual, callAI: vi.fn() }
})

const { callAI } = await import('../../../src/lib/ai.js')
beforeEach(() => vi.clearAllMocks())

const chunk = (content) => ({ content })

describe('contextualizeChunks', () => {
  test('single-chunk sources are not contextualized and cost no AI call', async () => {
    const out = await contextualizeChunks({}, { document: 'doc', chunks: [chunk('only one')] })
    expect(out).toEqual([''])
    expect(callAI).not.toHaveBeenCalled()
  })

  test('sends ONE call per batch with the document, not one per chunk', async () => {
    callAI.mockResolvedValue(JSON.stringify({ contexts: ['ctx a', 'ctx b', 'ctx c'] }))
    const chunks = [chunk('a'), chunk('b'), chunk('c')]
    const out = await contextualizeChunks({}, { document: 'the whole document', chunks })
    expect(callAI).toHaveBeenCalledTimes(1)
    expect(out).toEqual(['ctx a', 'ctx b', 'ctx c'])
    const { prompt } = callAI.mock.calls[0][1]
    expect(prompt).toContain('the whole document')
  })

  test('returns empty strings (never throws) when the model fails', async () => {
    callAI.mockResolvedValue(null)
    const out = await contextualizeChunks({}, { document: 'doc', chunks: [chunk('a'), chunk('b')] })
    expect(out).toEqual(['', ''])
  })

  // A short answer used to be padded with '' and accepted. That is the
  // pipeline's worst failure shape — a context-free chunk is indistinguishable
  // from a good one, so the damage is invisible until the DB is inspected.
  // Splitting and retrying is what makes a large batch size safe.
  test('splits and retries when the model returns too few contexts', async () => {
    callAI
      .mockResolvedValueOnce(JSON.stringify({ contexts: ['ctx a'] }))       // asked 2, got 1
      .mockResolvedValueOnce(JSON.stringify({ contexts: ['ctx a'] }))       // retry half
      .mockResolvedValueOnce(JSON.stringify({ contexts: ['ctx b'] }))       // retry half
    const out = await contextualizeChunks({}, { document: 'doc', chunks: [chunk('a'), chunk('b')] })
    expect(out).toEqual(['ctx a', 'ctx b'])
    expect(callAI).toHaveBeenCalledTimes(3)
  })

  test('does not retry when every chunk came back with a context', async () => {
    callAI.mockResolvedValue(JSON.stringify({ contexts: ['a', 'b', 'c'] }))
    await contextualizeChunks({}, { document: 'doc', chunks: [chunk('a'), chunk('b'), chunk('c')] })
    expect(callAI).toHaveBeenCalledTimes(1)
  })

  // Bounded, so a model that always answers short degrades instead of recursing
  // forever. Without a depth cap this is an unbounded spend on a bad document.
  test('gives up rather than recursing forever on a model that always answers short', async () => {
    callAI.mockResolvedValue(JSON.stringify({ contexts: [] }))
    const chunks = Array.from({ length: 8 }, (_, i) => chunk(String(i)))
    const out = await contextualizeChunks({}, { document: 'doc', chunks })
    expect(out).toEqual(Array(8).fill(''))
    expect(callAI.mock.calls.length).toBeLessThanOrEqual(8)
  })

  test('keeps the better of the two attempts', async () => {
    callAI
      .mockResolvedValueOnce(JSON.stringify({ contexts: ['good a', 'good b'] })) // 2 of 3
      .mockResolvedValue(JSON.stringify({ contexts: [] }))                       // retries do worse
    const out = await contextualizeChunks({}, { document: 'doc', chunks: [chunk('a'), chunk('b'), chunk('c')] })
    expect(out).toEqual(['good a', 'good b', ''])
  })
})
