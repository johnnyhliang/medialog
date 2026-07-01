import { describe, test, expect, vi } from 'vitest'
import { listTopics, createTopic, getTopicByName, listDeletedTopics, archiveTopic, unarchiveTopic, softDeleteTopic, restoreDeletedTopic } from './topics.js'

import { mockSupabase as mockClient } from '../../test/mockSupabase.js'

describe('topics db', () => {
  test('listTopics returns rows ordered by name with entry_count', async () => {
    const rows = [
      { id: '1', name: 'AI', entries: [{ count: 5 }] },
      { id: '2', name: 'Film', entries: [] },
    ]
    const client = mockClient({ data: rows, error: null })
    const result = await listTopics(client)
    expect(client.from).toHaveBeenCalledWith('topics')
    expect(result[0].entry_count).toBe(5)
    expect(result[1].entry_count).toBe(0)
  })

  test('createTopic inserts and returns the new row', async () => {
    const row = { id: '3', name: 'Fitness' }
    const client = mockClient({ data: row, error: null })
    const result = await createTopic(client, 'Fitness')
    expect(client._chain.insert).toHaveBeenCalledWith({ name: 'Fitness' })
    expect(result).toEqual(row)
  })

  test('listTopics throws on error', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(listTopics(client)).rejects.toThrow('boom')
  })

  test('getTopicByName returns the matching topic', async () => {
    const row = { id: 'inbox-id', name: 'Inbox' }
    const client = mockClient({ data: row, error: null })
    const result = await getTopicByName(client, 'Inbox')
    expect(client._chain.eq).toHaveBeenCalledWith('name', 'Inbox')
    expect(result).toEqual(row)
  })
})

describe('topic lifecycle', () => {
  function makeChain(resolveWith) {
    const chain = {
      select: vi.fn(() => chain),
      is: vi.fn(() => chain),
      not: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => Promise.resolve(resolveWith)),
      update: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(resolveWith)),
    }
    return chain
  }

  test('listTopics filters deleted_at IS NULL', async () => {
    const chain = makeChain({ data: [{ id: 't1', name: 'AI', entries: [{ count: 2 }] }], error: null })
    const sb = { from: vi.fn(() => chain) }
    const result = await listTopics(sb)
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(result[0].entry_count).toBe(2)
  })

  test('listDeletedTopics filters NOT NULL deleted_at', async () => {
    const chain = makeChain({ data: [{ id: 't2', name: 'Old', deleted_at: '2026-06-01', entries: [{ count: 0 }] }], error: null })
    const sb = { from: vi.fn(() => chain) }
    const result = await listDeletedTopics(sb)
    expect(chain.not).toHaveBeenCalledWith('deleted_at', 'is', null)
    expect(result[0].name).toBe('Old')
  })

  test('archiveTopic sets archived_at', async () => {
    const chain = makeChain({ data: { id: 't1', archived_at: '2026-06-20' }, error: null })
    const sb = { from: vi.fn(() => chain) }
    await archiveTopic(sb, 't1')
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ archived_at: expect.any(String) }))
  })

  test('unarchiveTopic clears archived_at', async () => {
    const chain = makeChain({ data: { id: 't1', archived_at: null }, error: null })
    const sb = { from: vi.fn(() => chain) }
    await unarchiveTopic(sb, 't1')
    expect(chain.update).toHaveBeenCalledWith({ archived_at: null })
  })

  test('softDeleteTopic updates entries then topic', async () => {
    const entriesChain = makeChain({ error: null })
    const topicsChain = makeChain({ error: null })
    let call = 0
    const sb = { from: vi.fn(() => call++ === 0 ? entriesChain : topicsChain) }
    await softDeleteTopic(sb, 't1')
    expect(entriesChain.update).toHaveBeenCalled()
    expect(topicsChain.update).toHaveBeenCalled()
  })

  test('restoreDeletedTopic clears deleted_at on entries and topic', async () => {
    const entriesChain = makeChain({ error: null })
    const topicsChain = makeChain({ error: null })
    let call = 0
    const sb = { from: vi.fn(() => call++ === 0 ? entriesChain : topicsChain) }
    await restoreDeletedTopic(sb, 't1')
    expect(entriesChain.update).toHaveBeenCalledWith({ deleted_at: null })
    expect(topicsChain.update).toHaveBeenCalledWith({ deleted_at: null })
  })
})

describe('updateTopicDoc', () => {
  test('updates master_doc and returns the row', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 't1', master_doc: '# Hello' }, error: null })
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    const supabase = { from: vi.fn(() => ({ update })) }

    const { updateTopicDoc } = await import('./topics.js')
    const row = await updateTopicDoc(supabase, 't1', '# Hello')

    expect(supabase.from).toHaveBeenCalledWith('topics')
    expect(update).toHaveBeenCalledWith({ master_doc: '# Hello' })
    expect(eq).toHaveBeenCalledWith('id', 't1')
    expect(row).toEqual({ id: 't1', master_doc: '# Hello' })
  })
})
