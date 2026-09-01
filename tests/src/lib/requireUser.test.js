import { describe, test, expect } from 'vitest'
import { requireUser, getUserOrNull, NotSignedInError } from '../../../src/lib/requireUser.js'

const client = (result) => ({ auth: { getUser: async () => result } })

describe('requireUser', () => {
  test('returns the user on success', async () => {
    const user = await requireUser(client({ data: { user: { id: 'u1' } }, error: null }))
    expect(user.id).toBe('u1')
  })

  // The failure the inline destructure could not express: getUser succeeded,
  // there is no session, and the old code carried on to build a query filtered
  // by `user_id: undefined` — which does not error, returns nothing, and is
  // indistinguishable from an account with no data.
  test('throws NotSignedInError when there is no session', async () => {
    await expect(requireUser(client({ data: { user: null }, error: null })))
      .rejects.toBeInstanceOf(NotSignedInError)
  })

  // The other one: on error `data` is null, so `data: { user }` threw a
  // TypeError about reading 'user' of null — an error about object shape,
  // raised far from the actual auth failure.
  test('surfaces the auth error itself, not a TypeError about null', async () => {
    const authError = new Error('refresh_token_not_found')
    await expect(requireUser(client({ data: null, error: authError })))
      .rejects.toThrow('refresh_token_not_found')
  })

  test('a signed-out state is distinguishable from a database failure', async () => {
    try {
      await requireUser(client({ data: { user: null }, error: null }))
    } catch (e) {
      expect(e.name).toBe('NotSignedInError')
    }
  })
})

describe('getUserOrNull', () => {
  test('returns null when signed out rather than throwing', async () => {
    expect(await getUserOrNull(client({ data: { user: null }, error: null }))).toBeNull()
  })

  test('still throws on a genuine auth error — absent is not the same as broken', async () => {
    await expect(getUserOrNull(client({ data: null, error: new Error('network') })))
      .rejects.toThrow('network')
  })

  test('returns the user when there is one', async () => {
    const u = await getUserOrNull(client({ data: { user: { id: 'u2' } }, error: null }))
    expect(u.id).toBe('u2')
  })
})
