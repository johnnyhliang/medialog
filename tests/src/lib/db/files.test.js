import { describe, test, expect, vi } from 'vitest'
import {
  listAttachments,
  signAttachmentUrl,
  deleteAttachment,
  listEntriesReferencingFile,
} from '../../../../src/lib/db/files.js'
import { DbError } from '../../../../src/lib/db/unwrap.js'
import { mockSupabase } from '../../../helpers/mockSupabase.js'

// Storage isn't part of mockSupabase (it's a different client surface), so the
// bucket half gets its own tiny fake. The point of each assertion is the same:
// the user-id path prefix is built in one place, and a failure throws.
function mockStorage(result) {
  const bucket = {
    list: vi.fn(() => Promise.resolve(result)),
    createSignedUrl: vi.fn(() => Promise.resolve(result)),
    remove: vi.fn(() => Promise.resolve(result)),
  }
  return { storage: { from: vi.fn(() => bucket) }, _bucket: bucket }
}

describe('files db — attachments bucket', () => {
  test('listAttachments lists the user folder', async () => {
    const client = mockStorage({ data: [{ name: 'a.png' }], error: null })
    const rows = await listAttachments(client, 'u1')
    expect(client.storage.from).toHaveBeenCalledWith('attachments')
    expect(client._bucket.list).toHaveBeenCalledWith('u1')
    expect(rows).toEqual([{ name: 'a.png' }])
  })

  test('listAttachments throws instead of reporting an empty folder', async () => {
    const client = mockStorage({ data: null, error: { message: 'bucket down' } })
    await expect(listAttachments(client, 'u1')).rejects.toBeInstanceOf(DbError)
  })

  test('signAttachmentUrl builds the userId/name path and returns the url', async () => {
    const client = mockStorage({ data: { signedUrl: 'https://s/x' }, error: null })
    const url = await signAttachmentUrl(client, 'u1', 'a.png')
    expect(client._bucket.createSignedUrl).toHaveBeenCalledWith('u1/a.png', 3600)
    expect(url).toBe('https://s/x')
  })

  test('signAttachmentUrl returns null when storage has no url, throws when it fails', async () => {
    const empty = mockStorage({ data: null, error: null })
    await expect(signAttachmentUrl(empty, 'u1', 'a.png')).resolves.toBeNull()
    const failed = mockStorage({ data: null, error: { message: 'expired' } })
    await expect(signAttachmentUrl(failed, 'u1', 'a.png')).rejects.toBeInstanceOf(DbError)
  })

  test('deleteAttachment removes the prefixed path and surfaces failure', async () => {
    const client = mockStorage({ data: [{}], error: null })
    await deleteAttachment(client, 'u1', 'a.png')
    expect(client._bucket.remove).toHaveBeenCalledWith(['u1/a.png'])

    const failed = mockStorage({ data: null, error: { message: 'denied' } })
    await expect(deleteAttachment(failed, 'u1', 'a.png')).rejects.toBeInstanceOf(DbError)
  })
})

describe('files db — entry references', () => {
  test('listEntriesReferencingFile matches notes and excludes trashed entries', async () => {
    const client = mockSupabase({ data: [{ id: 'e1', title: 'T', topic_id: 't1' }], error: null })
    const rows = await listEntriesReferencingFile(client, 'https://s/x.png')
    expect(client.from).toHaveBeenCalledWith('entries')
    expect(client._chain.select).toHaveBeenCalledWith('id, title, topic_id')
    expect(client._chain.like).toHaveBeenCalledWith('note', '%https://s/x.png%')
    expect(client._chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(rows).toHaveLength(1)
  })

  test('listEntriesReferencingFile throws rather than claiming no references', async () => {
    const client = mockSupabase({ data: null, error: { message: 'boom' } })
    await expect(listEntriesReferencingFile(client, 'u')).rejects.toBeInstanceOf(DbError)
  })
})
