import { describe, test, expect } from 'vitest'
import { applySnapshot, BackupRecordError } from '../../../../src/lib/db/githubBackup.js'

// A restore filtered by `user_id: undefined` does not error — it just writes
// rows nobody owns. Failing loudly at the auth check is the only point where
// that is still cheap to catch.
describe('applySnapshot auth', () => {
  const authStub = (result) => ({
    auth: { getUser: async () => result },
    from: () => { throw new Error('must not touch the database when signed out') },
  })

  test('refuses to restore when signed out, and says so specifically', async () => {
    const p = applySnapshot(authStub({ data: { user: null }, error: null }), { tables: {} })
    await expect(p).rejects.toThrow('Not signed in')
    await expect(p).rejects.toMatchObject({ name: 'NotSignedInError' })
  })

  test('surfaces a real auth error rather than mislabelling it as signed out', async () => {
    const err = new Error('refresh token expired')
    await expect(applySnapshot(authStub({ data: null, error: err }), { tables: {} }))
      .rejects.toThrow('refresh token expired')
  })
})

// The commit has already landed when the record write runs, so this one error
// must NOT say the backup failed — it demonstrably did not. Nor may it be
// swallowed, or the UI shows a stale "last backup" beside a green tick. It stays
// loud and states both halves.
describe('BackupRecordError', () => {
  test('says the data is safe, and carries the successful result', () => {
    const result = { sha: 'abc123', counts: { entries: 5 } }
    const e = new BackupRecordError({ message: 'permission denied' }, result)

    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('BackupRecordError')
    expect(e.message).toContain('committed successfully')
    expect(e.message).toContain('permission denied')
    expect(e.message).toContain('safe in GitHub')
    // A caller that catches this must not tell the user to run the backup again.
    expect(e.message).not.toMatch(/backup failed/i)
    expect(e.result).toEqual(result)
  })

  test('is distinguishable from a DbError, which does mean the backup failed', () => {
    const e = new BackupRecordError({ message: 'x' }, {})
    expect(e.name).not.toBe('DbError')
  })
})
