import { describe, test, expect, vi } from 'vitest'
import { getReviewCounts, getFocusEntry, listResurfaceHighlights } from '../../../../src/lib/db/review.js'
import { mockSupabase as mockClient } from '../../../helpers/mockSupabase.js'

// `getReviewCounts` fires seven queries whose results are all different shapes
// (a maybeSingle row, four counts, two row lists), so it needs a mock that
// answers per call rather than the shared one-result helper. Results are
// consumed in construction order, which is fixed and asserted below.
function seqClient(results) {
  const calls = []
  const from = vi.fn((table) => {
    const call = { table, filters: [] }
    calls.push(call)
    const result = results[calls.length - 1]
    const chain = {}
    const thenable = () => Object.assign(Promise.resolve(result), chain)
    for (const m of ['select', 'eq', 'neq', 'lt', 'gte', 'is', 'or', 'order', 'limit']) {
      chain[m] = vi.fn((...args) => { call.filters.push([m, ...args]); return thenable() })
    }
    chain.maybeSingle = vi.fn(() => Promise.resolve(result))
    return chain
  })
  return { from, calls }
}

const count = (n) => ({ data: null, count: n, error: null })
const ok = (data) => ({ data, error: null })

// The seven queries, in the order getReviewCounts builds them.
const INBOX_TOPIC = 0, STALE = 1, ACTIVE = 2, RECENT = 3, ALL_TOPICS = 4, INBOX = 5, OLD_INBOX = 6

function defaultResults(over = {}) {
  const r = [
    ok({ id: 'inbox' }),
    count(0), count(0),
    ok([]), ok([]),
    count(0), count(0),
  ]
  for (const [k, v] of Object.entries(over)) r[k] = v
  return r
}

describe('getReviewCounts', () => {
  test('returns the five badge numbers', async () => {
    const client = seqClient(defaultResults({
      [STALE]: count(7), [ACTIVE]: count(2), [INBOX]: count(5), [OLD_INBOX]: count(3),
      [RECENT]: ok([{ topic_id: 't1' }]),
      [ALL_TOPICS]: ok([{ id: 't1' }, { id: 't2' }, { id: 't3' }]),
    }))
    expect(await getReviewCounts(client)).toEqual({
      inbox: 5, oldInbox: 3, staleBacklog: 7, active: 2, dormant: 2,
    })
  })

  test('reports zeroes and skips the inbox queries when there is no Inbox topic', async () => {
    const client = seqClient(defaultResults({ [INBOX_TOPIC]: ok(null) }))
    const counts = await getReviewCounts(client)
    expect(counts.inbox).toBe(0)
    expect(counts.oldInbox).toBe(0)
    // Five queries, not seven: the two inbox counts are not issued at all.
    expect(client.from).toHaveBeenCalledTimes(5)
  })

  test('every entry count filters deleted and snoozed rows', async () => {
    // Regression: not one of the four count queries had the snooze guard its
    // siblings in entries.js apply, so an entry the user had explicitly put
    // off still drove the badge telling them to go deal with it.
    const client = seqClient(defaultResults())
    await getReviewCounts(client)
    for (const i of [STALE, ACTIVE, INBOX, OLD_INBOX]) {
      expect(client.calls[i].filters).toContainEqual(['is', 'deleted_at', null])
      expect(client.calls[i].filters).toContainEqual([
        'or', 'surface_after.is.null,surface_after.lte.now()',
      ])
    }
  })

  test('the inbox count excludes done entries, matching the old-inbox count', async () => {
    // Regression: `oldInbox` filtered `status != done` and `inbox`, built three
    // lines away over the same topic, did not — so finished reading left in
    // the Inbox was reported as "waiting".
    const client = seqClient(defaultResults())
    await getReviewCounts(client)
    expect(client.calls[INBOX].filters).toContainEqual(['neq', 'status', 'done'])
  })

  test('the dormant query is deliberately not snooze-filtered', async () => {
    // Scheduling an entry for later is still activity in that topic; filtering
    // it here would report maintained topics as dormant.
    const client = seqClient(defaultResults())
    await getReviewCounts(client)
    expect(client.calls[RECENT].filters.some(([m]) => m === 'or')).toBe(false)
  })

  test('a failed count throws rather than reporting an all-clear zero', async () => {
    const client = seqClient(defaultResults({
      [ACTIVE]: { data: null, count: null, error: { message: 'boom' } },
    }))
    await expect(getReviewCounts(client)).rejects.toThrow('boom')
  })
})

describe('getFocusEntry', () => {
  test('returns the single active entry', async () => {
    const row = { id: 'e1', title: 'CSAPP' }
    const client = mockClient({ data: [row], error: null })
    expect(await getFocusEntry(client)).toEqual(row)
    expect(client._chain.eq).toHaveBeenCalledWith('status', 'active')
    expect(client._chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(client._chain.or).toHaveBeenCalledWith('surface_after.is.null,surface_after.lte.now()')
    expect(client._chain.limit).toHaveBeenCalledWith(1)
  })

  test('returns null when nothing is active', async () => {
    expect(await getFocusEntry(mockClient({ data: [], error: null }))).toBeNull()
  })

  test('throws on failure rather than looking like nothing is active', async () => {
    const client = mockClient({ data: null, error: { message: 'down' } })
    await expect(getFocusEntry(client)).rejects.toThrow('down')
  })
})

describe('listResurfaceHighlights', () => {
  test('excludes highlights whose entry is in the trash', async () => {
    // An inner join, not a left join: with the default embed PostgREST honours
    // the filter by nulling `entries`, leaving a quote with no source to open.
    const client = mockClient({ data: [], error: null })
    await listResurfaceHighlights(client)
    expect(client.from).toHaveBeenCalledWith('highlights')
    expect(client._chain.select).toHaveBeenCalledWith(
      'id, text, created_at, entries!inner(id, title, url)',
    )
    expect(client._chain.is).toHaveBeenCalledWith('entries.deleted_at', null)
  })

  test('only returns highlights older than the 30-day cutoff', async () => {
    const client = mockClient({ data: [], error: null })
    await listResurfaceHighlights(client)
    const [col, cutoff] = client._chain.lt.mock.calls[0]
    expect(col).toBe('created_at')
    const age = Date.now() - new Date(cutoff).getTime()
    expect(age).toBeGreaterThan(29 * 86400000)
    expect(age).toBeLessThan(31 * 86400000)
  })

  test('throws on failure', async () => {
    const client = mockClient({ data: null, error: { message: 'nope' } })
    await expect(listResurfaceHighlights(client)).rejects.toThrow('nope')
  })
})
