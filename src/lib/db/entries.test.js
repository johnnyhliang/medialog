import { describe, test, expect, vi } from 'vitest'
import {
  listEntriesByTopic,
  createEntry,
  updateEntry,
  deleteEntry,
  searchEntries,
} from './entries.js'

function mockClient(result) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}

describe('entries db', () => {
  test('listEntriesByTopic filters by topic, newest first', async () => {
    const rows = [{ id: 'a', note: 'hi' }]
    const client = mockClient({ data: rows, error: null })
    const result = await listEntriesByTopic(client, 'topic-1')
    expect(client.from).toHaveBeenCalledWith('entries')
    expect(client._chain.eq).toHaveBeenCalledWith('topic_id', 'topic-1')
    expect(client._chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(rows)
  })

  test('createEntry inserts provided fields', async () => {
    const row = { id: 'b', topic_id: 't', url: 'http://x', note: 'n' }
    const client = mockClient({ data: row, error: null })
    const result = await createEntry(client, { topicId: 't', url: 'http://x', note: 'n' })
    expect(client._chain.insert).toHaveBeenCalledWith({
      topic_id: 't', url: 'http://x', title: null, note: 'n',
    })
    expect(result).toEqual(row)
  })

  test('updateEntry applies a partial patch by id', async () => {
    const row = { id: 'b', note: 'edited' }
    const client = mockClient({ data: row, error: null })
    const result = await updateEntry(client, 'b', { note: 'edited' })
    expect(client._chain.update).toHaveBeenCalledWith({ note: 'edited' })
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'b')
    expect(result).toEqual(row)
  })

  test('deleteEntry removes by id', async () => {
    const client = mockClient({ data: null, error: null })
    await deleteEntry(client, 'b')
    expect(client._chain.delete).toHaveBeenCalled()
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'b')
  })

  test('searchEntries matches note or title', async () => {
    const rows = [{ id: 'a', note: 'react' }]
    const client = mockClient({ data: rows, error: null })
    const result = await searchEntries(client, 'react')
    expect(client._chain.or).toHaveBeenCalledWith('note.ilike.%react%,title.ilike.%react%')
    expect(result).toEqual(rows)
  })
})
