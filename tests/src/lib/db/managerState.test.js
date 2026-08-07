import { describe, test, expect, vi } from 'vitest'
import { mockSupabase } from '../../../helpers/mockSupabase.js'
import {
  listTopicStates, listTopicActivity, loadManagerData,
  setNextAction, parkTopic, unparkTopic,
} from '../../../../src/lib/db/managerState.js'

function withAuth(client, userId = 'u1') {
  client.auth = { getUser: vi.fn(async () => ({ data: { user: { id: userId } } })) }
  return client
}

describe('reads', () => {
  test('listTopicStates returns the rows', async () => {
    const rows = [{ topic_id: 't1', next_action: 'x' }]
    const c = mockSupabase({ data: rows, error: null })
    expect(await listTopicStates(c)).toEqual(rows)
    expect(c.from).toHaveBeenCalledWith('topic_state')
  })

  test('listTopicActivity fetches only the three derived columns, minus deleted', async () => {
    const c = mockSupabase({ data: [], error: null })
    await listTopicActivity(c)
    expect(c.from).toHaveBeenCalledWith('entries')
    expect(c._chain.select).toHaveBeenCalledWith('topic_id, status, updated_at')
    expect(c._chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  test('null data degrades to an empty array', async () => {
    const c = mockSupabase({ data: null, error: null })
    expect(await listTopicStates(c)).toEqual([])
    expect(await listTopicActivity(c)).toEqual([])
  })

  test('errors throw with the message', async () => {
    const c = mockSupabase({ data: null, error: { message: 'nope' } })
    await expect(listTopicStates(c)).rejects.toThrow('nope')
    await expect(listTopicActivity(c)).rejects.toThrow('nope')
  })

  test('loadManagerData issues exactly two queries and no more', async () => {
    const c = mockSupabase({ data: [], error: null })
    const out = await loadManagerData(c)
    expect(out).toEqual({ states: [], entries: [] })
    expect(c.from).toHaveBeenCalledTimes(2)
  })

  test('loadManagerData without a client is inert', async () => {
    expect(await loadManagerData(null)).toEqual({ states: [], entries: [] })
  })
})

describe('writes', () => {
  test('setNextAction upserts on topic_id with the current user', async () => {
    const c = withAuth(mockSupabase({ data: { topic_id: 't1' }, error: null }))
    await setNextAction(c, 't1', '  finish ch. 5 notes  ')
    const [row, opts] = c._chain.upsert.mock.calls[0]
    expect(row).toEqual(expect.objectContaining({
      topic_id: 't1', user_id: 'u1', next_action: 'finish ch. 5 notes',
    }))
    expect(row.updated_at).toEqual(expect.any(String))
    expect(opts).toEqual({ onConflict: 'topic_id' })
  })

  test('a blank next action stores null rather than an empty string', async () => {
    const c = withAuth(mockSupabase({ data: {}, error: null }))
    await setNextAction(c, 't1', '   ')
    expect(c._chain.upsert.mock.calls[0][0].next_action).toBeNull()
  })

  test('parkTopic stamps parked_at and keeps the note', async () => {
    const c = withAuth(mockSupabase({ data: {}, error: null }))
    await parkTopic(c, 't1', 'waiting on the course')
    const row = c._chain.upsert.mock.calls[0][0]
    expect(row.parked_at).toEqual(expect.any(String))
    expect(row.parked_note).toBe('waiting on the course')
  })

  test('parking with no note is allowed', async () => {
    const c = withAuth(mockSupabase({ data: {}, error: null }))
    await parkTopic(c, 't1', '')
    expect(c._chain.upsert.mock.calls[0][0].parked_note).toBeNull()
  })

  test('unparkTopic clears both park fields and leaves next_action alone', async () => {
    const c = withAuth(mockSupabase({ data: {}, error: null }))
    await unparkTopic(c, 't1')
    const row = c._chain.upsert.mock.calls[0][0]
    expect(row.parked_at).toBeNull()
    expect(row.parked_note).toBeNull()
    expect(row).not.toHaveProperty('next_action')
  })

  test('a failed write throws', async () => {
    const c = withAuth(mockSupabase({ data: null, error: { message: 'rls' } }))
    await expect(setNextAction(c, 't1', 'x')).rejects.toThrow('rls')
  })
})
