import { describe, test, expect, vi } from 'vitest'
import {
  listEntriesByTopic,
  createEntry,
  updateEntry,
  searchEntries,
  bulkCreateEntries,
  listForRevisit,
  markSurfaced,
} from './entries.js'
import { computeTitle } from '../entryTitle.js'
import { mockSupabase as mockClient } from '../../test/mockSupabase.js'

describe('entries db', () => {
  test('listEntriesByTopic orders pinned first then newest, flattening tags', async () => {
    const raw = [{ id: 'a', note: 'hi', pinned: true, entry_tags: [{ tags: { name: 'book' } }] }]
    const client = mockClient({ data: raw, error: null })
    const result = await listEntriesByTopic(client, 'topic-1')
    expect(client.from).toHaveBeenCalledWith('entries')
    expect(client._chain.select).toHaveBeenCalledWith('*, entry_tags(tags(name))')
    expect(client._chain.eq).toHaveBeenCalledWith('topic_id', 'topic-1')
    expect(client._chain.order).toHaveBeenCalledWith('pinned', { ascending: false })
    expect(client._chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual([{ id: 'a', note: 'hi', pinned: true, tags: ['book'] }])
  })

  test('createEntry inserts provided fields', async () => {
    const row = { id: 'b', topic_id: 't', url: 'http://x', note: 'n' }
    const client = mockClient({ data: row, error: null })
    const result = await createEntry(client, { topicId: 't', url: 'http://x', note: 'n' })
    expect(client._chain.insert).toHaveBeenCalledWith({
      topic_id: 't', url: 'http://x', title: 'n', note: 'n',
    })
    expect(result).toEqual(row)
  })

  test('updateEntry applies a partial patch by id', async () => {
    const row = { id: 'b', note: 'edited' }
    const client = mockClient({ data: row, error: null })
    const result = await updateEntry(client, 'b', { note: 'edited' })
    expect(client._chain.update).toHaveBeenCalledWith({ note: 'edited', title: 'edited' })
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'b')
    expect(result).toEqual(row)
  })

  test('searchEntries matches note or title', async () => {
    const rows = [{ id: 'a', note: 'react', entry_tags: [] }]
    const client = mockClient({ data: rows, error: null })
    const result = await searchEntries(client, 'react')
    expect(client._chain.select).toHaveBeenCalledWith('*, entry_tags(tags(name)), topics(name)')
    expect(client._chain.or).toHaveBeenCalledWith('note.ilike.%react%,title.ilike.%react%')
    expect(result).toEqual([{ id: 'a', note: 'react', tags: [], topicName: null }])
  })

  test('bulkCreateEntries inserts all items under a topic', async () => {
    const rows = [{ id: '1' }, { id: '2' }]
    const client = mockClient({ data: rows, error: null })
    const items = [{ url: 'http://a', note: '' }, { url: null, note: 'idea' }]
    const result = await bulkCreateEntries(client, 'inbox-id', items)
    expect(client._chain.insert).toHaveBeenCalledWith([
      { topic_id: 'inbox-id', url: 'http://a', title: null, note: '' },
      { topic_id: 'inbox-id', url: null, title: null, note: 'idea' },
    ])
    expect(result).toEqual(rows)
  })

  test('listForRevisit orders by last_surfaced_at nulls first', async () => {
    const raw = [{ id: 'a', note: 'x', entry_tags: [] }]
    const client = mockClient({ data: raw, error: null })
    const result = await listForRevisit(client, 5)
    expect(client._chain.order).toHaveBeenCalledWith('last_surfaced_at', {
      ascending: true, nullsFirst: true,
    })
    expect(client._chain.limit).toHaveBeenCalledWith(5)
    expect(result).toEqual([{ id: 'a', note: 'x', tags: [] }])
  })

  test('markSurfaced sets last_surfaced_at on the entry', async () => {
    const client = mockClient({ data: null, error: null })
    await markSurfaced(client, 'e1')
    expect(client._chain.update).toHaveBeenCalled()
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'e1')
  })
})

describe('entry title persistence', () => {
  test('createEntry stores computed title from note H1', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const supabase = { from: vi.fn(() => ({ insert })) }

    await createEntry(supabase, { topicId: 't1', note: '# Cool Note\nbody' })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cool Note' }))
  })

  test('createEntry keeps explicit title when note empty', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const supabase = { from: vi.fn(() => ({ insert })) }

    await createEntry(supabase, { topicId: 't1', note: '', title: 'Fetched Title', url: 'https://x.com' })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fetched Title' }))
  })

  test('updateEntry recomputes title when note updated', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    const supabase = { from: vi.fn(() => ({ update })) }

    await updateEntry(supabase, 'e1', { note: '# New Title\nx' })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }))
  })

  test('updateEntry leaves title alone when note not in patch', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    const supabase = { from: vi.fn(() => ({ update })) }

    await updateEntry(supabase, 'e1', { status: 'done' })

    expect(update).toHaveBeenCalledWith({ status: 'done' })
  })
})
