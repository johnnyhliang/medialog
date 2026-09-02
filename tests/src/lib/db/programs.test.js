import { describe, test, expect } from 'vitest'
import {
  listPrograms, setProgramWindowOpen, setProgramDeadline, createProgram,
  listWatchlistPrograms, createWatchlistProgram, deleteProgram,
} from '../../../../src/lib/db/programs.js'
import { mockSupabase as mockClient } from '../../../helpers/mockSupabase.js'

// Every one of these has a failure case. The bug this module was extracted from
// survived precisely because the tab's tests only ever mocked `error: null`, so
// the path where a write is rejected had no coverage at all.
const FAIL = { data: null, error: { message: 'permission denied' } }

describe('programs db', () => {
  test('listPrograms returns rows ordered by name', async () => {
    const rows = [{ id: 'p1', name: 'Neo' }]
    const client = mockClient({ data: rows, error: null })
    expect(await listPrograms(client)).toEqual(rows)
    expect(client.from).toHaveBeenCalledWith('programs')
    expect(client._chain.order).toHaveBeenCalledWith('name')
  })

  test('listPrograms throws rather than reporting an empty table', async () => {
    // The distinction that matters: a failed read must not be indistinguishable
    // from an account with no programs.
    await expect(listPrograms(mockClient(FAIL))).rejects.toThrow('permission denied')
  })

  test('setProgramWindowOpen writes the flag for one id', async () => {
    const client = mockClient({ data: null, error: null })
    await setProgramWindowOpen(client, 'p1', true)
    expect(client._chain.update).toHaveBeenCalledWith({ window_open: true })
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'p1')
  })

  test('setProgramWindowOpen throws on a rejected write', async () => {
    await expect(setProgramWindowOpen(mockClient(FAIL), 'p1', true)).rejects.toThrow('permission denied')
  })

  test('setProgramDeadline stores a cleared date as null, not an empty string', async () => {
    const client = mockClient({ data: null, error: null })
    await setProgramDeadline(client, 'p1', '')
    expect(client._chain.update).toHaveBeenCalledWith({ deadline: null })
  })

  test('setProgramDeadline passes a real date through', async () => {
    const client = mockClient({ data: null, error: null })
    await setProgramDeadline(client, 'p1', '2026-09-09')
    expect(client._chain.update).toHaveBeenCalledWith({ deadline: '2026-09-09' })
  })

  test('setProgramDeadline throws on a rejected write', async () => {
    await expect(setProgramDeadline(mockClient(FAIL), 'p1', '2026-09-09')).rejects.toThrow('permission denied')
  })

  test('createProgram trims, defaults the window closed, and returns the row', async () => {
    const row = { id: 'new', name: 'Neo' }
    const client = mockClient({ data: row, error: null })
    const created = await createProgram(client, {
      name: '  Neo  ', url: ' https://neo.com ', category: 'program', deadline: '', notes: '  ',
    })
    expect(created).toEqual(row)
    expect(client._chain.insert).toHaveBeenCalledWith({
      name: 'Neo',
      url: 'https://neo.com',
      category: 'program',
      deadline: null,
      notes: null,
      window_open: false,
    })
  })

  test('createProgram keeps notes when there are any', async () => {
    const client = mockClient({ data: { id: 'new' }, error: null })
    await createProgram(client, { name: 'Neo', url: 'u', category: 'program', deadline: null, notes: 'referral from Dana' })
    expect(client._chain.insert).toHaveBeenCalledWith(expect.objectContaining({ notes: 'referral from Dana' }))
  })

  test('createProgram throws on a rejected insert', async () => {
    await expect(
      createProgram(mockClient(FAIL), { name: 'Neo', url: 'u', category: 'program', deadline: null, notes: null }),
    ).rejects.toThrow('permission denied')
  })
})

// Moved here from opportunities.test.js when the two divergent copies of the
// programs queries were consolidated: one module owns the table, so one test
// file covers it.
describe('program watchlist', () => {
  test('listWatchlistPrograms orders by opening date with undated programs last', async () => {
    const rows = [{ id: 'p1', name: 'Fellowship' }]
    const client = mockClient({ data: rows, error: null })
    expect(await listWatchlistPrograms(client)).toEqual(rows)
    expect(client._chain.order).toHaveBeenCalledWith('opens_at', { ascending: true, nullsFirst: false })
  })

  test('listWatchlistPrograms throws instead of returning an empty watchlist', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(listWatchlistPrograms(client)).rejects.toThrow('boom')
  })

  test('createWatchlistProgram trims and nulls out the optional fields', async () => {
    const client = mockClient({ data: { id: 'p1' }, error: null })
    await createWatchlistProgram(client, { name: '  Rise  ', url: ' https://rise.org ', notes: '   ', opens_at: '' })
    expect(client._chain.insert).toHaveBeenCalledWith({
      name: 'Rise', url: 'https://rise.org', notes: null, opens_at: null,
    })
  })

  // `programs` has no INSERT policy for signed-out users; the old call site
  // destructured `data` only, so an RLS refusal looked like nothing happening.
  test('createWatchlistProgram surfaces a refused insert', async () => {
    const client = mockClient({ data: null, error: { message: 'violates row-level security policy' } })
    await expect(createWatchlistProgram(client, { name: 'Rise', url: 'https://rise.org' }))
      .rejects.toThrow(/row-level security/)
  })

  // The gap this function is shaped around: `programs` still has no DELETE
  // policy (0044 dropped it, 0077 restored only INSERT and UPDATE), and a
  // blocked delete is not an error — it is a success affecting zero rows.
  // Returning the rows is the only way the caller can tell the difference.
  test('deleteProgram reports zero deleted rows rather than success', async () => {
    const client = mockClient({ data: [], error: null })
    expect(await deleteProgram(client, 'p1')).toEqual([])
  })

  test('deleteProgram returns the row when the delete really happened', async () => {
    const client = mockClient({ data: [{ id: 'p1' }], error: null })
    expect(await deleteProgram(client, 'p1')).toEqual([{ id: 'p1' }])
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'p1')
  })
})
