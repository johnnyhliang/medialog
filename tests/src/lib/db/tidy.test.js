import { describe, test, expect, vi } from 'vitest'
import { listTidyQueue } from '../../../../src/lib/db/tidy.js'

// The shared `mockSupabase` helper hands every `from()` the same chain and the
// same result, which cannot express "the inbox query returned these rows and
// the stale query returned those". This queue is built from two queries whose
// interaction (dedupe, ordering, the inbox-wins rule) is the whole point, so
// the mock here resolves per call in the order the queries are constructed and
// records the filters each one applied.
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
    return chain
  })
  return { from, calls }
}

const ok = (data) => ({ data, error: null })
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

describe('listTidyQueue', () => {
  test('inbox items come first, oldest first, tagged as inbox', async () => {
    const client = seqClient([
      ok([{ id: 'a', topic_id: 'inbox', created_at: daysAgo(9) }]),
      ok([{ id: 'b', topic_id: 't1', updated_at: daysAgo(40) }]),
    ])
    const queue = await listTidyQueue(client, 'inbox')
    expect(queue.map((e) => e.id)).toEqual(['a', 'b'])
    expect(queue[0].tidySource).toBe('inbox')
    expect(queue[0].tidySince).toBe(queue[0].created_at)
    expect(queue[1].tidySource).toBe('stale')
    expect(queue[1].tidySince).toBe(queue[1].updated_at)
  })

  test('an entry that is both inbox and stale is queued once, as inbox', async () => {
    const row = { id: 'a', topic_id: 'inbox', created_at: daysAgo(60), updated_at: daysAgo(60) }
    const client = seqClient([ok([row]), ok([row])])
    const queue = await listTidyQueue(client, 'inbox')
    expect(queue).toHaveLength(1)
    expect(queue[0].tidySource).toBe('inbox')
  })

  test('a stale row still sitting in the inbox topic is dropped from the stale half', async () => {
    // Guards the `e.topic_id === inboxTopicId` half of the skip: a row can be
    // absent from the inbox query (it was past the 30-row limit) and still
    // must not be framed as "untouched", which reads as if it had been filed.
    const client = seqClient([
      ok([]),
      ok([{ id: 'z', topic_id: 'inbox', updated_at: daysAgo(90) }]),
    ])
    expect(await listTidyQueue(client, 'inbox')).toEqual([])
  })

  test('skips the inbox query entirely when there is no inbox topic', async () => {
    const client = seqClient([ok([{ id: 'b', topic_id: 't1', updated_at: daysAgo(40) }])])
    const queue = await listTidyQueue(client, null)
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(queue.map((e) => e.id)).toEqual(['b'])
  })

  test('both halves filter deleted and snoozed rows', async () => {
    // The regression this exists for: neither query applied the snooze guard,
    // so Tidy's own "snooze 30d" button put the card straight back in the
    // queue. `deleted_at` is checked alongside it because these are the two
    // filters the codebase re-types per call site.
    const client = seqClient([ok([]), ok([])])
    await listTidyQueue(client, 'inbox')
    for (const call of client.calls) {
      expect(call.filters).toContainEqual(['is', 'deleted_at', null])
      expect(call.filters).toContainEqual([
        'or', 'surface_after.is.null,surface_after.lte.now()',
      ])
    }
  })

  test('a failure throws instead of rendering as an empty, all-tidy queue', async () => {
    const client = seqClient([ok([]), { data: null, error: { message: 'boom' } }])
    await expect(listTidyQueue(client, 'inbox')).rejects.toThrow('boom')
  })
})
