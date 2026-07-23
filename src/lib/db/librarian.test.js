import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('./retrieval.js', () => ({ searchChunks: vi.fn() }))
vi.mock('../ai.js', () => ({ callAI: vi.fn() }))

import { searchChunks } from './retrieval.js'
import { callAI } from '../ai.js'
import { buildContext, askLibrarian } from './librarian.js'

const hits = [
  { chunkId: 'c1', entryId: 'e1', content: 'the spread compensates the maker for adverse selection', heading: 'Adverse selection', anchor: 'adv', score: 0.05 },
  { chunkId: 'c2', entryId: 'e2', content: 'market makers quote both sides and profit on the round trip', heading: null, anchor: null, score: 0.04 },
]
const titles = new Map([['e1', 'Trading and Exchanges'], ['e2', 'Market Making']])

describe('buildContext', () => {
  test('numbers passages and pairs them with citation sources', () => {
    const { block, sources } = buildContext(hits, titles)
    expect(block).toContain('[1] (Trading and Exchanges › Adverse selection)')
    expect(block).toContain('[2] (Market Making)')
    expect(sources).toHaveLength(2)
    expect(sources[0]).toMatchObject({ n: 1, entryId: 'e1', title: 'Trading and Exchanges', anchor: 'adv' })
    expect(sources[1]).toMatchObject({ n: 2, entryId: 'e2', heading: null })
  })

  test('truncates long passages but keeps the citation', () => {
    const long = [{ chunkId: 'c', entryId: 'e1', content: 'x'.repeat(2000), heading: null, anchor: null, score: 0.05 }]
    const { block } = buildContext(long, titles)
    expect(block).toContain('…')
    expect(block.length).toBeLessThan(900)
  })
})

describe('askLibrarian', () => {
  beforeEach(() => vi.clearAllMocks())

  test('empty question returns nothing without calling the model', async () => {
    const out = await askLibrarian({}, '   ')
    expect(out).toEqual({ answer: '', sources: [], usedContext: false })
    expect(searchChunks).not.toHaveBeenCalled()
    expect(callAI).not.toHaveBeenCalled()
  })

  test('no retrieval hits => honest miss, no hallucinated answer', async () => {
    searchChunks.mockResolvedValue([])
    const out = await askLibrarian({}, 'quantum gravity')
    expect(out.usedContext).toBe(false)
    expect(out.sources).toEqual([])
    expect(callAI).not.toHaveBeenCalled()
  })

  test('grounds the answer in retrieved passages and returns citations', async () => {
    searchChunks.mockResolvedValue(hits)
    const supabase = {
      from: () => ({
        select: () => ({
          in: () => ({
            is: () => ({ data: [{ id: 'e1', title: 'Trading and Exchanges' }, { id: 'e2', title: 'Market Making' }] }),
          }),
        }),
      }),
    }
    callAI.mockResolvedValue('Spreads pay makers for adverse selection [1], and makers earn the round trip [2].')
    const out = await askLibrarian(supabase, 'how do market makers make money')

    expect(out.usedContext).toBe(true)
    expect(out.sources.map((s) => s.entryId)).toEqual(['e1', 'e2'])
    // the model must have been handed the passages, not just the bare question
    const messages = callAI.mock.calls[0][1].messages
    expect(messages[0].role).toBe('system')
    expect(messages.at(-1).content).toContain('the spread compensates the maker')
  })

  test('surfaces a clear error when the provider is unconfigured', async () => {
    searchChunks.mockResolvedValue(hits)
    const supabase = { from: () => ({ select: () => ({ in: () => ({ is: () => ({ data: [] }) }) }) }) }
    callAI.mockResolvedValue(null)
    const out = await askLibrarian(supabase, 'anything')
    expect(out.error).toBe(true)
    expect(out.answer).toMatch(/AI_BASE_URL|provider/i)
    // citations still returned so the user sees what WOULD have been used
    expect(out.sources.length).toBeGreaterThan(0)
  })
})
