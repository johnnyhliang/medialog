import { describe, test, expect, vi } from 'vitest'
import { getOrCreateTag, setEntryTags, listTags } from './tags.js'

import { mockSupabase as mockClient } from '../../test/mockSupabase.js'

describe('tags db', () => {
  test('getOrCreateTag upserts by name and returns the row', async () => {
    const row = { id: 't1', name: 'book' }
    const client = mockClient({ data: row, error: null })
    const result = await getOrCreateTag(client, 'book')
    expect(client._chain.upsert).toHaveBeenCalledWith({ name: 'book' }, { onConflict: 'user_id,name' })
    expect(result).toEqual(row)
  })

  test('listTags returns all tag names ordered', async () => {
    const rows = [{ id: 't1', name: 'ai' }, { id: 't2', name: 'book' }]
    const client = mockClient({ data: rows, error: null })
    const result = await listTags(client)
    expect(client.from).toHaveBeenCalledWith('tags')
    expect(result).toEqual(rows)
  })

  test('setEntryTags clears then links the given tags', async () => {
    const client = mockClient({ data: { id: 't1', name: 'book' }, error: null })
    await setEntryTags(client, 'e1', ['book'])
    expect(client._chain.delete).toHaveBeenCalled()
    expect(client._chain.eq).toHaveBeenCalledWith('entry_id', 'e1')
    expect(client._chain.insert).toHaveBeenCalledWith([{ entry_id: 'e1', tag_id: 't1' }])
  })
})
