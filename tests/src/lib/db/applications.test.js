import { describe, test, expect, vi } from 'vitest'
import {
  listApplications,
  createApplication,
  updateApplicationStatus,
  updateApplicationNotes,
  deleteApplication,
} from '../../../../src/lib/db/applications.js'

import { mockSupabase as mockClient } from '../../../helpers/mockSupabase.js'

const withAuth = (client, user) => ({
  ...client,
  auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
})

describe('applications db', () => {
  test('listApplications returns the rows, newest touched first', async () => {
    const rows = [{ id: 'a1', company: 'Acme', status: 'applied' }]
    const client = mockClient({ data: rows, error: null })
    expect(await listApplications(client)).toEqual(rows)
    expect(client._chain.order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  // The whole point of the sweep. An empty pipeline is a state a job seeker
  // will believe without questioning, so a failed load must never render as one.
  test('listApplications throws instead of returning an empty pipeline', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(listApplications(client)).rejects.toThrow('boom')
  })

  test('createApplication stamps the signed-in user id', async () => {
    const row = { id: 'a1', company: 'Acme' }
    const client = withAuth(mockClient({ data: row, error: null }), { id: 'u1' })
    expect(await createApplication(client, { company: 'Acme', role: 'SWE' })).toEqual(row)
    expect(client._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', company: 'Acme' }),
    )
  })

  // Empty date inputs arrive as '' from the form. Postgres rejects '' as a date,
  // so this normalisation is load-bearing, not cosmetic.
  test('createApplication turns blank dates into null', async () => {
    const client = withAuth(mockClient({ data: {}, error: null }), { id: 'u1' })
    await createApplication(client, { company: 'Acme', applied_at: '', deadline: '' })
    expect(client._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ applied_at: null, deadline: null }),
    )
  })

  test('createApplication reports being signed out as being signed out', async () => {
    const client = withAuth(mockClient({ data: null, error: null }), null)
    await expect(createApplication(client, { company: 'Acme' }))
      .rejects.toMatchObject({ name: 'NotSignedInError' })
  })

  // The caller renders its optimistic row with the same `now` it passes here;
  // generating a second timestamp inside would re-sort the list by a value the
  // UI never showed.
  test('updateApplicationStatus persists the timestamp it was given', async () => {
    const client = mockClient({ data: null, error: null })
    await updateApplicationStatus(client, 'a1', 'screen', '2026-01-01T00:00:00.000Z')
    expect(client._chain.update).toHaveBeenCalledWith({
      status: 'screen', updated_at: '2026-01-01T00:00:00.000Z',
    })
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'a1')
  })

  test('updateApplicationStatus throws so the caller can roll its row back', async () => {
    const client = mockClient({ data: null, error: { message: 'nope' } })
    await expect(updateApplicationStatus(client, 'a1', 'screen')).rejects.toThrow('nope')
  })

  test('updateApplicationNotes touches updated_at alongside the notes', async () => {
    const client = mockClient({ data: null, error: null })
    await updateApplicationNotes(client, 'a1', 'called back')
    expect(client._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'called back' }),
    )
    expect(client._chain.update.mock.calls[0][0].updated_at).toEqual(expect.any(String))
  })

  test('deleteApplication throws so the caller reloads rather than lying', async () => {
    const client = mockClient({ data: null, error: { message: 'denied' } })
    await expect(deleteApplication(client, 'a1')).rejects.toThrow('denied')
  })
})
