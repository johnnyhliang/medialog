import { describe, test, expect } from 'vitest'
import { shouldUseTrigram, mmrSelect, bestPerEntry } from '../../../../src/lib/db/retrieval.js'

describe('shouldUseTrigram', () => {
  test('engages for short queries (where typos matter)', () => {
    expect(shouldUseTrigram('adverze selection')).toBe(true)
    expect(shouldUseTrigram('vwap')).toBe(true)
  })

  test('does not engage for long queries (trigram is noisy on prose)', () => {
    expect(shouldUseTrigram('why do market makers lose money to informed traders over time')).toBe(false)
  })

  test('does not engage on empty input', () => {
    expect(shouldUseTrigram('')).toBe(false)
    expect(shouldUseTrigram('   ')).toBe(false)
  })
})

describe('mmrSelect', () => {
  test('prefers high score but drops same-topic redundancy', () => {
    const candidates = [
      { id: 'a', score: 0.9, entryId: 'e1', topicId: 't1' },
      { id: 'b', score: 0.89, entryId: 'e2', topicId: 't1' }, // same topic as the winner
      { id: 'c', score: 0.7, entryId: 'e3', topicId: 't2' },  // different topic
    ]
    const out = mmrSelect(candidates, { k: 2, lambda: 0.5 })
    expect(out[0].id).toBe('a')
    expect(out[1].id).toBe('c') // diversity beats the marginally-higher same-topic hit
  })

  test('returns everything when k exceeds the candidate count', () => {
    const candidates = [{ id: 'a', score: 1, entryId: 'e1', topicId: 't1' }]
    expect(mmrSelect(candidates, { k: 5, lambda: 0.5 })).toHaveLength(1)
  })

  test('handles an empty candidate list', () => {
    expect(mmrSelect([], { k: 3, lambda: 0.5 })).toEqual([])
  })
})

describe('bestPerEntry', () => {
  test('keeps the first (highest-ranked) hit per entry', () => {
    const hits = [
      { chunkId: 'c1', entryId: 'e1', score: 0.05, content: 'best for e1' },
      { chunkId: 'c2', entryId: 'e1', score: 0.03, content: 'worse for e1' },
      { chunkId: 'c3', entryId: 'e2', score: 0.04, content: 'best for e2' },
    ]
    const out = bestPerEntry(hits)
    expect(out.map((h) => h.chunkId)).toEqual(['c1', 'c3'])
    expect(out[0].content).toBe('best for e1')
  })

  test('preserves incoming rank order and handles an empty list', () => {
    expect(bestPerEntry([])).toEqual([])
    const hits = [
      { chunkId: 'a', entryId: 'e9', score: 0.9 },
      { chunkId: 'b', entryId: 'e1', score: 0.1 },
    ]
    expect(bestPerEntry(hits).map((h) => h.entryId)).toEqual(['e9', 'e1'])
  })
})

// The §4 error sweep: these queries used to answer "nothing found" when they
// actually meant "the query failed". Each test pins the honest answer, because
// the silent-empty version of each of these passed too — that is the whole
// problem with it.
describe('failures are no longer indistinguishable from empty results', () => {
  const ok = (data) => Promise.resolve({ data, error: null })
  const fail = (message) => Promise.resolve({ data: null, error: { message } })

  const stub = ({ invoke, rpc, from }) => ({
    functions: { invoke: () => invoke ?? ok({ embedding: [0.1, 0.2] }) },
    rpc: () => rpc ?? ok([]),
    from: () => {
      const chain = {}
      for (const m of ['select', 'in', 'eq', 'is', 'limit']) chain[m] = () => chain
      return Object.assign(chain, { then: (res, rej) => (from ?? ok([])).then(res, rej) })
    },
  })

  test('a failed embed call throws instead of reporting an empty library', async () => {
    const { searchChunks } = await import('../../../../src/lib/db/retrieval.js')
    await expect(searchChunks(stub({ invoke: fail('embed down') }), { query: 'vwap' }))
      .rejects.toThrow('embed down')
  })

  test('a failed search RPC throws', async () => {
    const { searchChunks } = await import('../../../../src/lib/db/retrieval.js')
    await expect(searchChunks(stub({ rpc: fail('rpc exploded') }), { query: 'vwap' }))
      .rejects.toThrow('rpc exploded')
  })

  test('a failed hydrate throws rather than dropping every ranked hit', async () => {
    const { searchChunks } = await import('../../../../src/lib/db/retrieval.js')
    const s = stub({ rpc: ok([{ chunk_id: 'c1', score: 0.05 }]), from: fail('hydrate failed') })
    await expect(searchChunks(s, { query: 'vwap' })).rejects.toThrow('hydrate failed')
  })

  test('annotateEmbedded stays best-effort: a failure returns the entries unmarked', async () => {
    const { annotateEmbedded } = await import('../../../../src/lib/db/retrieval.js')
    const entries = [{ id: 'e1' }, { id: 'e2' }]
    await expect(annotateEmbedded(stub({ from: fail('down') }), entries)).resolves.toBe(entries)
  })

  test('an entry with no chunks still legitimately has nothing related', async () => {
    const { relatedTo } = await import('../../../../src/lib/db/retrieval.js')
    await expect(relatedTo(stub({ from: ok([]) }), { entryId: 'e1' })).resolves.toEqual([])
  })

  test('but a failed read of the entry\'s own vectors throws', async () => {
    const { relatedTo } = await import('../../../../src/lib/db/retrieval.js')
    await expect(relatedTo(stub({ from: fail('chunks down') }), { entryId: 'e1' }))
      .rejects.toThrow('chunks down')
  })
})
