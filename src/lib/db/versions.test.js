import { describe, test, expect, vi } from 'vitest'
import { listVersions, createVersion } from './versions.js'

function mockClient(result) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}

describe('versions db', () => {
  test('listVersions returns snapshots newest first', async () => {
    const rows = [{ id: 'v2', note: 'b' }, { id: 'v1', note: 'a' }]
    const client = mockClient({ data: rows, error: null })
    const result = await listVersions(client, 'e1')
    expect(client.from).toHaveBeenCalledWith('entry_versions')
    expect(client._chain.eq).toHaveBeenCalledWith('entry_id', 'e1')
    expect(client._chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(rows)
  })

  test('createVersion inserts a snapshot', async () => {
    const row = { id: 'v3', entry_id: 'e1', note: 'c' }
    const client = mockClient({ data: row, error: null })
    const result = await createVersion(client, 'e1', 'c')
    expect(client._chain.insert).toHaveBeenCalledWith({ entry_id: 'e1', note: 'c' })
    expect(result).toEqual(row)
  })
})
