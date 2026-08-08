// Reading more than one page out of PostgREST.
//
// THE BUG THIS EXISTS TO PREVENT: PostgREST caps every response at `max-rows`
// (1000 on this project) and returns the truncated set with **no error and no
// indication that anything was cut**. A `.select()` with no range therefore
// looks correct in tests, against mocks, and on any account small enough — and
// silently goes wrong the day real data crosses the line.
//
// It had already gone wrong once: `listTopicActivity` read 1000 of 1419 entries,
// which made 21 of 48 Manager cards show wrong counts and 16 show the wrong
// last-touched date — and last-touched is what momentum is derived from, so the
// feature's central claim was quietly false for a third of topics.
//
// Any query that can return an unbounded number of rows must come through here.
// A deliberate `.limit(n)` is fine; it is the *absence* of a bound that is the
// bug, because it reads as "all of them".

export const PAGE_SIZE = 1000

/**
 * Run a range-paged query to exhaustion.
 *
 * `makeQuery(from, to)` must build a FRESH query each call — a PostgREST builder
 * cannot be re-awaited — and **must impose a deterministic order**. Range paging
 * over an unordered result is not stable: the server may return rows in a
 * different order per request, which silently duplicates some and drops others.
 */
export async function fetchAllPages(makeQuery, label = 'query') {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}
