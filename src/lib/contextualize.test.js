import { describe, test, expect, vi, beforeEach } from 'vitest'
import { contextualizeChunks } from './contextualize.js'

vi.mock('./ai.js', async () => {
  const actual = await vi.importActual('./ai.js')
  return { ...actual, callAI: vi.fn() }
})

const { callAI } = await import('./ai.js')
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

  test('pads when the model returns too few contexts', async () => {
    callAI.mockResolvedValue(JSON.stringify({ contexts: ['only one'] }))
    const out = await contextualizeChunks({}, { document: 'doc', chunks: [chunk('a'), chunk('b')] })
    expect(out).toEqual(['only one', ''])
  })
})
