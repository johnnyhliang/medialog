import { describe, test, expect, vi } from 'vitest'
import { listTopics, createTopic, getTopicByName } from './topics.js'

function mockClient(result) {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}

describe('topics db', () => {
  test('listTopics returns rows ordered by name', async () => {
    const rows = [{ id: '1', name: 'AI' }, { id: '2', name: 'Film' }]
    const client = mockClient({ data: rows, error: null })
    const result = await listTopics(client)
    expect(client.from).toHaveBeenCalledWith('topics')
    expect(result).toEqual(rows)
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
