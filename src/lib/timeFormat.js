// The canonical relative-time formatters.
//
// There were five: `timeAgo` in FeedView and Revisit, `formatAge` in
// OpportunityView, FeedWidget and OpportunitiesWidget. They disagreed in five
// separate ways, so this is not a mechanical dedupe — picking one changes what
// some screens display, and REFACTOR.md §6.1 is right that the behaviour has to
// be reconciled before any sweep.
//
// What they disagreed about:
//
//   1. Suffix. Revisit said "5m ago"; everything else said "5m".
//   2. Range. Revisit went up to years; the other four stopped at days, so a
//      year-old item read "400d".
//   3. Input. Two took a Date, three took a string.
//   4. Nullish. FeedView and Revisit returned null, FeedWidget returned '', and
//      the two Opportunities copies dereferenced without checking.
//   5. Future dates. Only FeedWidget clamped, so a row with a clock-skewed
//      timestamp could render "-3m" everywhere else.
//
// Two exports rather than one with an options bag, because the two shapes are
// genuinely different registers: prose next to a sentence, and a compact chip in
// a dense row where "ago" on every line is noise.

const MINUTE = 60000
const HOUR = 3600000
const DAY = 86400000

/**
 * Milliseconds elapsed, or null when there is nothing to measure.
 * Negative values clamp to 0: a timestamp in the future is almost always clock
 * skew, and "in -3 minutes" is never the useful thing to say about it.
 */
function elapsed(input) {
  if (input === null || input === undefined || input === '') return null
  const then = input instanceof Date ? input.getTime() : new Date(input).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Date.now() - then)
}

/**
 * Prose form: "just now", "5m ago", "3h ago", "2d ago", "3w ago", "5mo ago",
 * "2y ago". Returns null for a missing or unparseable date so callers can
 * decide whether to render anything at all.
 *
 * This is Revisit's wording, which was the richest of the five and the only one
 * that stayed readable past a month.
 */
export function timeAgo(input) {
  const diff = elapsed(input)
  if (diff === null) return null
  const m = Math.floor(diff / MINUTE)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

/**
 * Compact form for chips and dense rows: "just now", "5m", "3h", "2d", "3w",
 * "5mo", "2y". Returns null for a missing date.
 *
 * Two deliberate behaviour changes from the four `formatAge` copies it replaces,
 * both visible:
 *
 *   - Under a minute now reads "just now" rather than "0m". The old output was
 *     technically true and told the reader nothing.
 *   - Past 365 days it reads "1y" rather than "400d". Nobody counts in
 *     three-digit days, and the Opportunities and Feed lists both accumulate
 *     items well past that.
 */
export function shortAge(input) {
  const diff = elapsed(input)
  if (diff === null) return null
  const m = Math.floor(diff / MINUTE)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(diff / HOUR)
  if (h < 24) return `${h}h`
  const d = Math.floor(diff / DAY)
  if (d < 7) return `${d}d`
  if (d < 30) return `${Math.floor(d / 7)}w`
  if (d < 365) return `${Math.floor(d / 30)}mo`
  return `${Math.floor(d / 365)}y`
}
