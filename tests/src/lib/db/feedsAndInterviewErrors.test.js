// Covers the §4 error-handling sweep on feeds.js / interview.js / conversations.js.
//
// These tests exist because the bug being fixed is invisible by construction: a
// failed query and an empty table used to produce the same value, so nothing
// short of asserting "this throws" can tell the two apart.

import { describe, test, expect } from 'vitest'
import { getFeedItemCounts, listFeeds, createFeed } from '../../../../src/lib/db/feeds.js'
import { listInterview, seedPatterns } from '../../../../src/lib/db/interview.js'
import { listConversations, addMessage } from '../../../../src/lib/db/conversations.js'
import { DbError } from '../../../../src/lib/db/unwrap.js'
import { NotSignedInError } from '../../../../src/lib/requireUser.js'

// A thenable query builder: every chainable method returns `this`, and awaiting
// it resolves to the canned Supabase result. Mirrors how the real client defers
// the request until await, so `query.eq(...)` after the fact still works.
function builder(result) {
  const q = {
    then: (res, rej) => Promise.resolve(result).then(res, rej),
    count: result.count,
  }
  for (const m of ['select', 'order', 'is', 'gt', 'lt', 'eq', 'in', 'not', 'limit',
    'insert', 'update', 'delete', 'upsert', 'single']) q[m] = () => q
  return q
}

function fakeSupabase({ result = { data: [], error: null }, user = { id: 'u1' }, authError = null } = {}) {
  return {
    from: () => builder(result),
    auth: { getUser: async () => ({ data: user ? { user } : { user: null }, error: authError }) },
  }
}

const dbFailure = { data: null, error: { message: 'connection reset', code: '08006' } }

describe('feeds: a failed query no longer reads as empty', () => {
  test('getFeedItemCounts throws instead of returning {}', async () => {
    // The old code did `if (error) return {}`, which rendered every feed as
    // "0 unread" whenever the database was unreachable.
    await expect(getFeedItemCounts(fakeSupabase({ result: dbFailure })))
      .rejects.toBeInstanceOf(DbError)
  })

  test('getFeedItemCounts still returns {} for a genuinely empty inbox', async () => {
    await expect(getFeedItemCounts(fakeSupabase({ result: { data: [], error: null } })))
      .resolves.toEqual({})
  })

  test('getFeedItemCounts tallies rows per feed', async () => {
    const rows = [{ feed_id: 'a' }, { feed_id: 'a' }, { feed_id: 'b' }]
    await expect(getFeedItemCounts(fakeSupabase({ result: { data: rows, error: null } })))
      .resolves.toEqual({ a: 2, b: 1 })
  })

  test('listFeeds surfaces the failure with its context attached', async () => {
    const err = await listFeeds(fakeSupabase({ result: dbFailure })).catch((e) => e)
    expect(err).toBeInstanceOf(DbError)
    expect(err.context).toBe('listFeeds')
    // The message stays the raw cause, so existing `addToast(e.message)` callers
    // show exactly what they showed before.
    expect(err.message).toBe('connection reset')
    expect(err.code).toBe('08006')
  })

  test('createFeed refuses to run signed out rather than writing user_id undefined', async () => {
    await expect(createFeed(fakeSupabase({ user: null }), { url: 'u', name: 'n' }))
      .rejects.toBeInstanceOf(NotSignedInError)
  })
})

describe('interview: seeding and listing fail loudly', () => {
  test('listInterview throws on a failed pattern query', async () => {
    await expect(listInterview(fakeSupabase({ result: dbFailure })))
      .rejects.toBeInstanceOf(DbError)
  })

  test('listInterview returns the empty shape when there are no patterns', async () => {
    await expect(listInterview(fakeSupabase({ result: { data: [], error: null } })))
      .resolves.toEqual({ patterns: [], problemsByTopic: {} })
  })

  test('seedPatterns throws rather than re-seeding under an unknown user', async () => {
    await expect(seedPatterns(fakeSupabase({ user: null }), []))
      .rejects.toBeInstanceOf(NotSignedInError)
  })

  test('seedPatterns throws when the existing-topics lookup fails', async () => {
    // Previously this lookup's error was dropped, so `byName` came back empty
    // and every pattern was inserted a second time.
    await expect(seedPatterns(fakeSupabase({ result: dbFailure }), [{ name: 'P' }]))
      .rejects.toBeInstanceOf(DbError)
  })
})

describe('conversations: DbError is a drop-in for the old Error', () => {
  test('listConversations rejects with something a plain catch still handles', async () => {
    const err = await listConversations(fakeSupabase({ result: dbFailure })).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(DbError)
    expect(err.message).toBe('connection reset')
  })

  test('addMessage returns the inserted row unchanged on success', async () => {
    const row = { id: 'm1', role: 'user', content: 'hi', sources: [] }
    await expect(addMessage(fakeSupabase({ result: { data: row, error: null } }), 'c1', { role: 'user', content: 'hi' }))
      .resolves.toEqual(row)
  })
})
