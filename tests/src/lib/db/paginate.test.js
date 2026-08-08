import { describe, test, expect, vi } from 'vitest'
import { fetchAllPages, PAGE_SIZE } from '../../../../src/lib/db/paginate.js'

// A fake PostgREST that enforces the thing the real one enforces silently:
// never return more than PAGE_SIZE rows, and never say that you truncated.
function pagedSource(total) {
  const all = Array.from({ length: total }, (_, i) => ({ id: i }))
  return vi.fn(async (from, to) => ({
    data: all.slice(from, Math.min(to + 1, from + PAGE_SIZE)),
    error: null,
  }))
}

describe('fetchAllPages', () => {
  test('returns everything when it fits in one page', async () => {
    const q = pagedSource(5)
    expect(await fetchAllPages(q)).toHaveLength(5)
    expect(q).toHaveBeenCalledTimes(1)
  })

  test('keeps paging past the 1000-row cap — the actual bug', async () => {
    const q = pagedSource(1419)
    const rows = await fetchAllPages(q)
    expect(rows).toHaveLength(1419)
    expect(q).toHaveBeenCalledTimes(2)
    // No gap and no duplicate across the page boundary.
    expect(new Set(rows.map((r) => r.id)).size).toBe(1419)
    expect(rows[999].id).toBe(999)
    expect(rows[1000].id).toBe(1000)
  })

  test('handles many pages', async () => {
    const q = pagedSource(3000)
    expect(await fetchAllPages(q)).toHaveLength(3000)
    // 1000, 1000, 1000, then an empty page to learn it is done.
    expect(q).toHaveBeenCalledTimes(4)
  })

  test('an exact multiple needs one extra request to terminate', async () => {
    const q = pagedSource(PAGE_SIZE)
    expect(await fetchAllPages(q)).toHaveLength(PAGE_SIZE)
    expect(q).toHaveBeenCalledTimes(2)
  })

  test('requests contiguous, non-overlapping ranges', async () => {
    const q = pagedSource(2500)
    await fetchAllPages(q)
    expect(q.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  test('empty result is an empty array, not a hang', async () => {
    expect(await fetchAllPages(pagedSource(0))).toEqual([])
  })

  test('null data terminates rather than looping forever', async () => {
    const q = vi.fn(async () => ({ data: null, error: null }))
    expect(await fetchAllPages(q)).toEqual([])
    expect(q).toHaveBeenCalledTimes(1)
  })

  test('errors throw with the label, and stop paging', async () => {
    const q = vi.fn(async () => ({ data: null, error: { message: 'boom' } }))
    await expect(fetchAllPages(q, 'entries')).rejects.toThrow('entries: boom')
    expect(q).toHaveBeenCalledTimes(1)
  })

  test('an error on a later page still throws', async () => {
    const all = pagedSource(1500)
    const q = vi.fn(async (from, to) =>
      from === 0 ? all(from, to) : { data: null, error: { message: 'late' } })
    await expect(fetchAllPages(q, 'contributions')).rejects.toThrow('contributions: late')
  })
})
