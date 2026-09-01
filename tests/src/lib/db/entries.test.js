import { describe, test, expect, vi } from 'vitest'
import {
  listEntriesByTopic,
  createEntry,
  updateEntry,
  searchEntries,
  bulkCreateEntries,
  listForRevisit,
  markSurfaced,
  retireEntry,
  unretireEntry,
} from '../../../../src/lib/db/entries.js'
import { DbError } from '../../../../src/lib/db/unwrap.js'
import { mockSupabase as mockClient } from '../../../helpers/mockSupabase.js'

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
      topic_id: 't', url: 'http://x', title: 'n', note: 'n', title_edited: false,
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
      { topic_id: 'inbox-id', url: 'http://a', title: null, note: '', title_edited: false },
      { topic_id: 'inbox-id', url: null, title: null, note: 'idea', title_edited: false },
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

  test('listForRevisit excludes retired entries', async () => {
    const client = mockClient({ data: [], error: null })
    await listForRevisit(client, 5)
    // Without this the queue has no terminal state: Hard/Good/Easy all
    // reschedule, so a retired entry would keep coming back forever.
    expect(client._chain.is).toHaveBeenCalledWith('retired_at', null)
    expect(client._chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  test('retireEntry stamps retired_at and clears the schedule', async () => {
    const client = mockClient({ data: null, error: null })
    await retireEntry(client, 'e1')
    const patch = client._chain.update.mock.calls[0][0]
    expect(patch.retired_at).toEqual(expect.any(String))
    expect(patch.surface_after).toBeNull()
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'e1')
  })

  test('unretireEntry clears retired_at so it returns to the queue', async () => {
    const client = mockClient({ data: null, error: null })
    await unretireEntry(client, 'e1')
    expect(client._chain.update).toHaveBeenCalledWith({ retired_at: null, surface_after: null })
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

  test('updateEntry recomputes title when note updated and title was never edited', async () => {
    // The conditional update matches, so the mirrored title is what lands.
    const supabase = mockClient({ data: [{ id: 'e1' }], error: null })

    await updateEntry(supabase, 'e1', { note: '# New Title\nx' })

    expect(supabase._chain.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }))
    expect(supabase._chain.eq).toHaveBeenCalledWith('title_edited', false)
  })

  test('updateEntry leaves title alone when note not in patch', async () => {
    const supabase = mockClient({ data: { id: 'e1' }, error: null })

    await updateEntry(supabase, 'e1', { status: 'done' })

    expect(supabase._chain.update).toHaveBeenCalledWith({ status: 'done' })
    expect(supabase._chain.update).toHaveBeenCalledTimes(1)
  })

  test('updateEntry does not mirror note into title once the title was edited', async () => {
    // No row matches `title_edited = false`, so the note saves on its own.
    const supabase = mockClient({ data: [], error: null })

    await updateEntry(supabase, 'e1', { note: 'a totally different first line' })

    expect(supabase._chain.update).toHaveBeenLastCalledWith({ note: 'a totally different first line' })
  })

  test('updateEntry never infers title_edited from an automatic title fetch', async () => {
    // Link-preview enrichment writes a title through the same path as a user
    // typing one — only an explicit flag may mark the title as user-owned.
    const supabase = mockClient({ data: { id: 'e1' }, error: null })

    await updateEntry(supabase, 'e1', { title: 'Fetched Page Title', og_image: 'i.png' })

    expect(supabase._chain.update).toHaveBeenCalledWith({ title: 'Fetched Page Title', og_image: 'i.png' })
  })

  test('updateEntry passes through an explicit title_edited from a real title edit', async () => {
    const supabase = mockClient({ data: { id: 'e1' }, error: null })

    await updateEntry(supabase, 'e1', { title: 'My Custom Title', title_edited: true })

    expect(supabase._chain.update).toHaveBeenCalledWith({ title: 'My Custom Title', title_edited: true })
  })

  test('createEntry marks a kept explicit title as edited', async () => {
    const supabase = mockClient({ data: { id: 'e1' }, error: null })

    await createEntry(supabase, { topicId: 't1', note: '', title: 'Curated', url: 'https://x.com' })

    expect(supabase._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Curated', title_edited: true }),
    )
  })

  test('a fetched title lands while the title is still unowned', async () => {
    const supabase = mockClient({ data: [{ id: 'e1' }], error: null })

    await updateEntry(supabase, 'e1', { title: 'Fetched', og_image: 'i.png' }, { autoTitle: true })

    expect(supabase._chain.update).toHaveBeenCalledWith({ title: 'Fetched', og_image: 'i.png' })
    expect(supabase._chain.eq).toHaveBeenCalledWith('title_edited', false)
  })

  test('a fetched title never overwrites a title the user already claimed', async () => {
    // Retitle a fresh capture before the link preview resolves: the conditional
    // update matches nothing, so only the non-title fields are saved.
    const supabase = mockClient({ data: [], error: null })

    await updateEntry(supabase, 'e1', { title: 'Fetched', og_image: 'i.png' }, { autoTitle: true })

    expect(supabase._chain.update).toHaveBeenLastCalledWith({ og_image: 'i.png' })
  })

  test('a title-only fetch against an owned title writes nothing at all', async () => {
    const supabase = mockClient({ data: [], error: null })

    await updateEntry(supabase, 'e1', { title: 'Fetched' }, { autoTitle: true })

    // One conditional update that matched nothing, then a read — never a
    // second update with an empty patch.
    expect(supabase._chain.update).toHaveBeenCalledTimes(1)
    expect(supabase._chain.select).toHaveBeenCalledWith('*')
  })

  test('updateEntry does not retitle to Untitled when the note is cleared', async () => {
    const supabase = mockClient({ data: { id: 'e1' }, error: null })

    await updateEntry(supabase, 'e1', { note: '   ' })

    expect(supabase._chain.update).toHaveBeenCalledTimes(1)
    expect(supabase._chain.update).toHaveBeenCalledWith({ note: '   ' })
  })

  test('bulkCreateEntries protects titles that arrived with the import', async () => {
    const supabase = mockClient({ data: [], error: null })

    await bulkCreateEntries(supabase, 'inbox', [
      { url: 'https://a.com', title: 'Curated', note: '' },
      { url: 'https://b.com', note: '' },
    ])

    expect(supabase._chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ title: 'Curated', title_edited: true }),
      expect.objectContaining({ title: null, title_edited: false }),
    ])
  })

  test('createEntry leaves a note-mirrored title unprotected', async () => {
    const supabase = mockClient({ data: { id: 'e1' }, error: null })

    await createEntry(supabase, { topicId: 't1', note: '# From note', title: 'Ignored' })

    expect(supabase._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'From note', title_edited: false }),
    )
  })
})

// A bare query chain (no `from`), so a test can hand different tables — or
// successive reads of the same table — different results.
const chainReturning = (result) => mockClient(result)._chain

describe('entries db surfaces failures instead of empty results', () => {
  test('a failed list throws a DbError carrying the raw message', async () => {
    const client = mockClient({ data: null, error: { message: 'connection reset', code: '08006' } })
    // The message is deliberately unprefixed: every caller already does
    // `addToast(e.message)`, and DbError extends Error so those catches are
    // unaffected by the type change.
    await expect(listEntriesByTopic(client, 't1')).rejects.toThrow('connection reset')
    await expect(listEntriesByTopic(client, 't1')).rejects.toBeInstanceOf(DbError)
  })

  test('searchEntries fails loudly when only the tag half fails', async () => {
    // Previously the tag query was destructured for `data` alone, so this case
    // returned a plausible-looking text-only result set and tag-name search
    // just silently stopped working.
    const entriesChain = chainReturning({ data: [], error: null })
    const tagChain = chainReturning({ data: null, error: { message: 'tag join failed' } })
    const client = { from: vi.fn((table) => (table === 'entry_tags' ? tagChain : entriesChain)) }
    await expect(searchEntries(client, 'react')).rejects.toThrow('tag join failed')
  })

  test('searchEntries fails loudly when the tag-matched entry fetch fails', async () => {
    // The second `entries` read — the by-id fetch for tag-only matches — is the
    // other site that dropped its error outright.
    const okChain = chainReturning({ data: [], error: null })
    const failChain = chainReturning({ data: null, error: { message: 'in() lookup failed' } })
    let entriesReads = 0
    const tagChain = chainReturning({ data: [{ entry_id: 'x' }], error: null })
    const client = {
      from: vi.fn((table) => {
        if (table === 'entry_tags') return tagChain
        entriesReads += 1
        return entriesReads === 1 ? okChain : failChain
      }),
    }
    await expect(searchEntries(client, 'react')).rejects.toThrow('in() lookup failed')
  })

  test('updateEntry does not read a failed conditional update as an owned title', async () => {
    // A failed auto-title update returns no rows, exactly like a title the user
    // owns. Conflating them would drop the patch and report success.
    const client = mockClient({ data: null, error: { message: 'update rejected' } })
    await expect(updateEntry(client, 'e1', { note: '# T\nx' })).rejects.toThrow('update rejected')
  })
})
