import { describe, test, expect, vi } from 'vitest'
import {
  listHighlightsForEntry,
  listAllHighlights,
  createHighlight,
  deleteHighlight,
} from '../../../../src/lib/db/highlights.js'
import { DbError } from '../../../../src/lib/db/unwrap.js'
import { NotSignedInError } from '../../../../src/lib/requireUser.js'
import { mockSupabase } from '../../../helpers/mockSupabase.js'

// mockSupabase has no auth surface; highlights writes need one.
function withAuth(client, user, error = null) {
  client.auth = { getUser: vi.fn(() => Promise.resolve({ data: { user }, error })) }
  return client
}

describe('highlights db', () => {
  test('listHighlightsForEntry reads one entry in creation order', async () => {
    const client = mockSupabase({ data: [{ id: 'h1' }], error: null })
    const rows = await listHighlightsForEntry(client, 'e1')
    expect(client.from).toHaveBeenCalledWith('highlights')
    expect(client._chain.eq).toHaveBeenCalledWith('entry_id', 'e1')
    expect(client._chain.order).toHaveBeenCalledWith('created_at')
    expect(rows).toEqual([{ id: 'h1' }])
  })

  test('listHighlightsForEntry throws instead of rendering as "no highlights"', async () => {
    const client = mockSupabase({ data: null, error: { message: 'nope' } })
    await expect(listHighlightsForEntry(client, 'e1')).rejects.toBeInstanceOf(DbError)
  })

  // The drift this refactor fixes: the library-wide list had no deleted_at
  // filter, so highlights of trashed entries stayed visible and clickable.
  test('listAllHighlights inner-joins entries and excludes deleted ones', async () => {
    const client = mockSupabase({ data: [{ id: 'h1', entries: { id: 'e1' } }], error: null })
    await listAllHighlights(client)
    expect(client._chain.select).toHaveBeenCalledWith('*, entries!inner(id, title, url, full_text)')
    expect(client._chain.is).toHaveBeenCalledWith('entries.deleted_at', null)
    expect(client._chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  test('createHighlight stamps the signed-in user and trims an empty note to null', async () => {
    const client = withAuth(mockSupabase({ data: { id: 'h9' }, error: null }), { id: 'u1' })
    const row = await createHighlight(client, {
      entryId: 'e1', text: 'quote', color: 'green', note: '   ',
    })
    expect(client._chain.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      entry_id: 'e1',
      text: 'quote',
      color: 'green',
      note: null,
    })
    expect(row).toEqual({ id: 'h9' })
  })

  test('createHighlight keeps a real note', async () => {
    const client = withAuth(mockSupabase({ data: { id: 'h9' }, error: null }), { id: 'u1' })
    await createHighlight(client, { entryId: 'e1', text: 't', color: 'blue', note: ' hm ' })
    expect(client._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'hm' })
    )
  })

  // Was a silent `if (!user) return` — the picker closed and nothing saved.
  test('createHighlight throws NotSignedInError when signed out', async () => {
    const client = withAuth(mockSupabase({ data: null, error: null }), null)
    await expect(
      createHighlight(client, { entryId: 'e1', text: 't', color: 'yellow', note: '' })
    ).rejects.toBeInstanceOf(NotSignedInError)
    expect(client.from).not.toHaveBeenCalled()
  })

  test('createHighlight surfaces an insert failure', async () => {
    const client = withAuth(mockSupabase({ data: null, error: { message: 'rls' } }), { id: 'u1' })
    await expect(
      createHighlight(client, { entryId: 'e1', text: 't', color: 'yellow', note: '' })
    ).rejects.toBeInstanceOf(DbError)
  })

  test('deleteHighlight deletes by id and throws on failure', async () => {
    const client = mockSupabase({ data: null, error: null })
    await deleteHighlight(client, 'h1')
    expect(client._chain.delete).toHaveBeenCalled()
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'h1')

    const failed = mockSupabase({ data: null, error: { message: 'denied' } })
    await expect(deleteHighlight(failed, 'h1')).rejects.toBeInstanceOf(DbError)
  })
})
