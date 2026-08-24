import { describe, test, expect, vi } from 'vitest'
import { mockSupabase } from '../../helpers/mockSupabase.js'
import { sourcesFor, hashText, chunkEntryAsync } from '../../../src/lib/chunkEntry.js'

describe('source_hash gate', () => {
  test('skips all AI/embedding work when the source text is unchanged', async () => {
    const note = 'short note'
    // existing row already carries this exact hash → nothing should be re-done
    const sb = mockSupabase({ data: [{ source_hash: hashText(note) }], error: null })
    sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
    sb.functions = { invoke: vi.fn() }

    await chunkEntryAsync(sb, { id: 'e1', note })

    // no embedding call, no insert — this gate is what stops re-embed churn/cost
    expect(sb.functions.invoke).not.toHaveBeenCalled()
    expect(sb._chain.insert).not.toHaveBeenCalled()
  })

  test('never throws when indexing fails — a save must not break', async () => {
    const sb = mockSupabase({ data: null, error: { message: 'boom' } })
    sb.auth = { getUser: async () => { throw new Error('no session') } }
    await expect(chunkEntryAsync(sb, { id: 'e1', note: 'x' })).resolves.toBeUndefined()
  })

  test('reconciles: a fully-cleared entry deletes all its chunks and embeds nothing', async () => {
    const sb = mockSupabase({ data: [], error: null })
    sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
    sb.functions = { invoke: vi.fn() }
    await chunkEntryAsync(sb, { id: 'e1' }) // no note/full_text/takeaway
    expect(sb._chain.delete).toHaveBeenCalled()
    expect(sb._chain.in).toHaveBeenCalledWith('source', ['full_text', 'note', 'takeaway'])
    expect(sb.functions.invoke).not.toHaveBeenCalled()
  })

  test('reconciles: a note-only entry drops the other sources', async () => {
    const sb = mockSupabase({ data: [], error: null })
    sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
    sb.functions = { invoke: vi.fn(async () => ({ data: { embeddings: [[0]] }, error: null })) }
    await chunkEntryAsync(sb, { id: 'e1', note: 'short note' })
    expect(sb._chain.in).toHaveBeenCalledWith('source', ['full_text', 'takeaway'])
  })
})

describe('index_status lifecycle', () => {
  // The failure this guards: an entry whose indexing is abandoned (tab closed
  // mid-import) used to keep index_status = null, which listUnindexed does not
  // select — unsearchable AND invisible to the retry banner.
  test('claims the entry as pending before doing any work', async () => {
    const sb = mockSupabase({ data: [], error: null })
    sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
    const calls = []
    sb.functions = {
      invoke: vi.fn(async () => {
        // At the moment work is happening, the claim must already be written.
        calls.push(sb._chain.update.mock.calls.map(([p]) => p.index_status))
        return { data: { embeddings: [[0]] }, error: null }
      }),
    }

    await chunkEntryAsync(sb, { id: 'e1', note: 'short note' })

    expect(calls[0]).toContain('pending')
    const statuses = sb._chain.update.mock.calls.map(([p]) => p.index_status)
    expect(statuses).toEqual(['pending', 'ok'])
  })

  test('pending does not stamp indexed_at — it has not finished', async () => {
    const sb = mockSupabase({ data: [], error: null })
    sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
    sb.functions = { invoke: vi.fn(async () => ({ data: { embeddings: [[0]] }, error: null })) }

    await chunkEntryAsync(sb, { id: 'e1', note: 'short note' })

    const pending = sb._chain.update.mock.calls.map(([p]) => p).find((p) => p.index_status === 'pending')
    expect(pending).toBeDefined()
    expect(pending.indexed_at).toBeUndefined()
  })

  test('an entry with nothing chunkable goes straight to empty, never pending', async () => {
    const sb = mockSupabase({ data: [], error: null })
    sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
    sb.functions = { invoke: vi.fn() }

    await chunkEntryAsync(sb, { id: 'e1' })

    const statuses = sb._chain.update.mock.calls.map(([p]) => p.index_status)
    expect(statuses).toEqual(['empty'])
  })
})

describe('sourcesFor', () => {
  test('a short note is indexed as a single un-split source', () => {
    const out = sourcesFor({ id: 'e1', note: 'short note' })
    expect(out).toEqual([{ source: 'note', text: 'short note', markdown: false }])
  })

  test('a long note is split with markdown structure', () => {
    const long = 'x'.repeat(2000)
    const out = sourcesFor({ id: 'e1', note: long })
    expect(out).toEqual([{ source: 'note', text: long, markdown: true }])
  })

  test('full_text is always a plain-text source', () => {
    const out = sourcesFor({ id: 'e1', full_text: 'article body' })
    expect(out).toContainEqual({ source: 'full_text', text: 'article body', markdown: false })
  })

  test('takeaway is a markdown source', () => {
    const out = sourcesFor({ id: 'e1', takeaway: 'the insight' })
    expect(out).toContainEqual({ source: 'takeaway', text: 'the insight', markdown: true })
  })

  test('an entry with note, full_text and takeaway yields all three', () => {
    const out = sourcesFor({ id: 'e1', note: 'n', full_text: 'f', takeaway: 't' })
    expect(out.map((s) => s.source).sort()).toEqual(['full_text', 'note', 'takeaway'])
  })

  test('empty entry yields nothing', () => {
    expect(sourcesFor({ id: 'e1' })).toEqual([])
    expect(sourcesFor({ id: 'e1', note: '   ' })).toEqual([])
  })
})

describe('hashText', () => {
  test('is stable and differs on change', () => {
    expect(hashText('abc')).toBe(hashText('abc'))
    expect(hashText('abc')).not.toBe(hashText('abd'))
  })
})
