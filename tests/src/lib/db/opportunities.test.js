import { describe, test, expect, vi } from 'vitest'
import {
  createManualOpportunity,
} from '../../../../src/lib/db/opportunities.js'

import { mockSupabase as mockClient } from '../../../helpers/mockSupabase.js'

const withAuth = (client, user) => ({
  ...client,
  auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
})

describe('manual opportunities', () => {
  test('titles the row with the hostname and stamps created_by', async () => {
    const client = withAuth(mockClient({ data: { id: 'o1' }, error: null }), { id: 'u1' })
    await createManualOpportunity(client, { url: '  https://jobs.acme.com/x  ', note: 'NYC', tag: 'swe' })
    expect(client._chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      source: 'manual',
      title: 'jobs.acme.com',
      url: 'https://jobs.acme.com/x',
      body: 'NYC',
      tags: ['swe'],
      created_by: 'u1',
    }))
  })

  // Capturing something unparseable beats rejecting it — the box exists to stop
  // a link being lost.
  test('falls back to the raw string when the url will not parse', async () => {
    const client = withAuth(mockClient({ data: { id: 'o1' }, error: null }), { id: 'u1' })
    await createManualOpportunity(client, { url: 'not a url', tag: 'swe' })
    expect(client._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'not a url', body: null }),
    )
  })

  // The regression this extraction exists to close: `select('*')` brings back
  // the legacy `opportunities.is_read/is_saved` columns that migration 0044
  // superseded, and both components pushed that row straight into the list.
  test('never returns the legacy flag columns from the shared table', async () => {
    const client = withAuth(
      mockClient({ data: { id: 'o1', title: 'x', is_read: true, is_saved: true }, error: null }),
      { id: 'u1' },
    )
    const row = await createManualOpportunity(client, { url: 'https://a.co', tag: 'swe' })
    expect(row).toEqual({ id: 'o1', title: 'x', is_read: false, is_saved: false })
  })

  test('reports being signed out as being signed out', async () => {
    const client = withAuth(mockClient({ data: null, error: null }), null)
    await expect(createManualOpportunity(client, { url: 'https://a.co', tag: 'swe' }))
      .rejects.toMatchObject({ name: 'NotSignedInError' })
  })

  test('throws rather than silently dropping the row the user typed', async () => {
    const client = withAuth(mockClient({ data: null, error: { message: 'rls' } }), { id: 'u1' })
    await expect(createManualOpportunity(client, { url: 'https://a.co', tag: 'swe' }))
      .rejects.toThrow('rls')
  })
})
