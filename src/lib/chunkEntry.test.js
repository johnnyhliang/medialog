import { describe, test, expect, vi } from 'vitest'
import { mockSupabase } from '../test/mockSupabase.js'
import { sourcesFor, hashText, chunkEntryAsync } from './chunkEntry.js'

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
