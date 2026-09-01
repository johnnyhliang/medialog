import { describe, test, expect, vi } from 'vitest'
import { listQuickLinks, createQuickLink, updateQuickLink, deleteQuickLink } from '../../../../src/lib/db/quickLinks.js'

import { mockSupabase as mockClient } from '../../../helpers/mockSupabase.js'

const withAuth = (client, user) => ({
  ...client,
  auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
})

describe('quick links db', () => {
  test('listQuickLinks returns the rows ordered by position', async () => {
    const rows = [{ id: 'q1', label: 'Docs', position: 0 }]
    const client = mockClient({ data: rows, error: null })
    expect(await listQuickLinks(client)).toEqual(rows)
    expect(client._chain.order).toHaveBeenCalledWith('position', { ascending: true })
  })

  // The point of the sweep: a failure must not arrive as an empty shelf, which
  // reads identically to "you have not added any links yet".
  test('listQuickLinks throws instead of returning an empty list', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(listQuickLinks(client)).rejects.toThrow('boom')
  })

  test('createQuickLink stamps the signed-in user id', async () => {
    const row = { id: 'q1', label: 'Docs' }
    const client = withAuth(mockClient({ data: row, error: null }), { id: 'u1' })
    expect(await createQuickLink(client, { label: 'Docs', url: 'https://x' })).toEqual(row)
    expect(client._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', label: 'Docs' }),
    )
  })

  // Previously this dereferenced `user.id` on undefined and surfaced as a
  // TypeError about property access, nowhere near the real cause.
  test('createQuickLink reports being signed out as being signed out', async () => {
    const client = withAuth(mockClient({ data: null, error: null }), null)
    await expect(createQuickLink(client, { label: 'Docs', url: 'https://x' }))
      .rejects.toMatchObject({ name: 'NotSignedInError' })
  })

  test('updateQuickLink and deleteQuickLink surface failures', async () => {
    const client = mockClient({ data: null, error: { message: 'nope' } })
    await expect(updateQuickLink(client, 'q1', { label: 'x' })).rejects.toThrow('nope')
    await expect(deleteQuickLink(client, 'q1')).rejects.toThrow('nope')
  })
})
