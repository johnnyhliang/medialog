import { describe, test, expect, vi } from 'vitest'
import {
  getUserConfig,
  getRadarKeywords,
  updateRadarKeywords,
  setTwitterAuthToken,
  disconnectGitHub,
  clearBackupError,
  updateBackupSettings,
  listCaptureLog,
  DISCONNECTED_GITHUB_FIELDS,
} from '../../../../src/lib/db/userConfig.js'
import { mockSupabase as mockClient } from '../../../helpers/mockSupabase.js'

const FAIL = { data: null, error: { message: 'permission denied' } }

// mockSupabase has no `auth`, so each test states which of the three auth
// outcomes it is exercising — signed in, signed out, or auth itself failing.
// The middle one is the interesting case: it is what a not-yet-settled session
// looks like, and the old inline `const { data: { user } }` destructure could
// not tell it apart from a hard failure.
function withAuth(result, user = { id: 'u1' }) {
  const client = mockClient(result)
  client.auth = { getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })) }
  return client
}

function signedOut(result = { data: null, error: null }) {
  return withAuth(result, null)
}

describe('userConfig db', () => {
  test('getUserConfig reads the signed-in user’s row', async () => {
    const row = { user_id: 'u1', theme: 'paper' }
    const client = withAuth({ data: row, error: null })
    expect(await getUserConfig(client)).toEqual(row)
    expect(client.from).toHaveBeenCalledWith('user_configs')
    expect(client._chain.eq).toHaveBeenCalledWith('user_id', 'u1')
  })

  test('getUserConfig returns null when signed out, without querying', async () => {
    const client = signedOut()
    expect(await getUserConfig(client)).toBeNull()
    expect(client.from).not.toHaveBeenCalled()
  })

  test('getUserConfig returns null when no row exists yet', async () => {
    // maybeSingle: an account that has never opened Settings has no row, and
    // that is not an error worth showing anyone.
    expect(await getUserConfig(withAuth({ data: null, error: null }))).toBeNull()
  })

  test('getUserConfig throws on a failed read', async () => {
    await expect(getUserConfig(withAuth(FAIL))).rejects.toThrow('permission denied')
  })

  test('getRadarKeywords selects only radar_keywords — no credential fields', async () => {
    const client = withAuth({ data: { radar_keywords: ['internship'] }, error: null })
    const result = await getRadarKeywords(client)
    expect(result).toEqual({ userId: 'u1', keywords: ['internship'] })
    // The guard against the keyword tab holding github_token / twitter_auth_token
    // in component state: the column list is asserted, not just the return value.
    expect(client._chain.select).toHaveBeenCalledWith('radar_keywords')
  })

  test('getRadarKeywords defaults a null column to an empty list', async () => {
    const client = withAuth({ data: { radar_keywords: null }, error: null })
    expect((await getRadarKeywords(client)).keywords).toEqual([])
  })

  test('getRadarKeywords returns null when signed out', async () => {
    expect(await getRadarKeywords(signedOut())).toBeNull()
  })

  test('getRadarKeywords throws on a failed read instead of returning no keywords', async () => {
    await expect(getRadarKeywords(withAuth(FAIL))).rejects.toThrow('permission denied')
  })

  test('updateRadarKeywords writes the list for one user', async () => {
    const client = mockClient({ data: null, error: null })
    await updateRadarKeywords(client, 'u1', ['ai'])
    expect(client._chain.update).toHaveBeenCalledWith({ radar_keywords: ['ai'] })
    expect(client._chain.eq).toHaveBeenCalledWith('user_id', 'u1')
  })

  test('updateRadarKeywords throws on a rejected write', async () => {
    await expect(updateRadarKeywords(mockClient(FAIL), 'u1', ['ai'])).rejects.toThrow('permission denied')
  })

  test('setTwitterAuthToken upserts so a first-time save is not a silent no-op', async () => {
    const client = withAuth({ data: null, error: null })
    await setTwitterAuthToken(client, 'abc')
    expect(client._chain.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', twitter_auth_token: 'abc' },
      { onConflict: 'user_id' },
    )
  })

  test('setTwitterAuthToken stores a cleared token as null', async () => {
    const client = withAuth({ data: null, error: null })
    await setTwitterAuthToken(client, '')
    expect(client._chain.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', twitter_auth_token: null },
      { onConflict: 'user_id' },
    )
  })

  test('setTwitterAuthToken throws NotSignedInError rather than writing user_id undefined', async () => {
    const client = signedOut()
    await expect(setTwitterAuthToken(client, 'abc')).rejects.toThrow('Not signed in')
    expect(client.from).not.toHaveBeenCalled()
  })

  test('setTwitterAuthToken throws on a rejected write', async () => {
    await expect(setTwitterAuthToken(withAuth(FAIL), 'abc')).rejects.toThrow('permission denied')
  })

  test('disconnectGitHub clears the whole account-scoped field set', async () => {
    const client = mockClient({ data: null, error: null })
    await disconnectGitHub(client, 'u1', 'medialog-backup')
    // Leaving repo_name behind is what causes the split-brain on the next link,
    // so the field set is asserted whole rather than field by field.
    expect(client._chain.update).toHaveBeenCalledWith({
      github_token: null,
      github_user: null,
      repo_name: 'medialog-backup',
      auto_backup: false,
      last_backup_sha: null,
      last_backup_summary: null,
      last_backup_at: null,
      last_error: null,
    })
    expect(client._chain.eq).toHaveBeenCalledWith('user_id', 'u1')
  })

  test('the exported field set is the one the write uses, so local state cannot drift', async () => {
    const client = mockClient({ data: null, error: null })
    await disconnectGitHub(client, 'u1', 'medialog-backup')
    expect(client._chain.update).toHaveBeenCalledWith(DISCONNECTED_GITHUB_FIELDS('medialog-backup'))
  })

  test('disconnectGitHub throws when the clear is rejected', async () => {
    // Believing a token is gone when it is not is the failure mode here.
    await expect(disconnectGitHub(mockClient(FAIL), 'u1', 'r')).rejects.toThrow('permission denied')
  })

  test('clearBackupError nulls just the error column', async () => {
    const client = mockClient({ data: null, error: null })
    await clearBackupError(client, 'u1')
    expect(client._chain.update).toHaveBeenCalledWith({ last_error: null })
  })

  test('clearBackupError throws on a rejected write', async () => {
    await expect(clearBackupError(mockClient(FAIL), 'u1')).rejects.toThrow('permission denied')
  })

  test('updateBackupSettings writes only the four fields the form owns', async () => {
    const client = mockClient({ data: null, error: null })
    // Deliberately handed a whole config row: the caller spreads its state in,
    // and the token must not ride along into the update.
    await updateBackupSettings(client, 'u1', {
      repo_name: 'r', repo_branch: 'dev', is_private: true, auto_backup: false,
      github_token: 'ghp_secret', theme: 'paper',
    })
    expect(client._chain.update).toHaveBeenCalledWith({
      repo_name: 'r', repo_branch: 'dev', is_private: true, auto_backup: false,
    })
  })

  test('updateBackupSettings defaults a blank branch to main', async () => {
    const client = mockClient({ data: null, error: null })
    await updateBackupSettings(client, 'u1', { repo_name: 'r', repo_branch: '', is_private: false, auto_backup: true })
    expect(client._chain.update).toHaveBeenCalledWith(expect.objectContaining({ repo_branch: 'main' }))
  })

  test('updateBackupSettings throws on a rejected write', async () => {
    await expect(
      updateBackupSettings(mockClient(FAIL), 'u1', { repo_name: 'r', repo_branch: 'main', is_private: false, auto_backup: false }),
    ).rejects.toThrow('permission denied')
  })

  test('listCaptureLog reads the newest entries', async () => {
    const rows = [{ id: 'l1', url: 'https://x', ok: true }]
    const client = mockClient({ data: rows, error: null })
    expect(await listCaptureLog(client)).toEqual(rows)
    expect(client.from).toHaveBeenCalledWith('capture_log')
    expect(client._chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(client._chain.limit).toHaveBeenCalledWith(8)
  })

  test('listCaptureLog throws rather than reporting no captures', async () => {
    await expect(listCaptureLog(mockClient(FAIL))).rejects.toThrow('permission denied')
  })
})
