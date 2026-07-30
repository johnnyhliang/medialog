// The Gains Feed picker: one plate per tap, rotated across Quant/Dev/Interview
// so no track goes silent, with due SM-2 reviews always winning first. Pure
// functions — no DB, no clock reads except through injected `now`/`rng`. See
// docs/gains-feed-design.md for the reasoning and the non-goals (no pace, no
// streak, no behind-indicator for Quant/Dev — this file must never grow one).

export const TRACKS = ['quant', 'dev', 'interview']
export const QUANT_STRANDS = ['quant-build', 'quant-read', 'quant-mental']

// Verbatim from gains-system.md's dead-day floor — a bypass, not a picker output.
export const FLOOR_ITEMS = {
  quant: '2 min of Zetamac, or read one paragraph of Harris',
  dev: "Read one section heading of whatever's active in the Concept Bank",
  interview: 'Read (don\'t solve) one NeetCode solution',
}

const MS_PER_DAY = 86400000

/**
 * Weighted-random rotation over a set of keys, weighted by staleness (longer
 * since last touched = higher odds), never zero so nothing is ever excluded —
 * this is odds, not a schedule. `lastTouched` maps key -> ISO string | null.
 */
export function staleWeights(keys, lastTouched = {}, now = Date.now()) {
  const weights = {}
  for (const key of keys) {
    const last = lastTouched[key]
    const daysSince = last ? (now - new Date(last).getTime()) / MS_PER_DAY : 30
    // +1 floor so a just-touched item still has non-zero odds; caps growth so
    // one very stale item can't make the others practically unreachable.
    weights[key] = Math.min(Math.max(daysSince, 0) + 1, 30)
  }
  return weights
}

/**
 * Pick one key from a weight map. `rng` defaults to Math.random but is
 * injectable for deterministic tests.
 */
export function weightedPick(weights, rng = Math.random) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  if (!entries.length) return null
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [key, w] of entries) {
    roll -= w
    if (roll <= 0) return key
  }
  return entries[entries.length - 1][0]
}

/**
 * Solved/takeaway rows whose review date has passed, oldest first. Mirrors
 * interviewPlan.js's dueReviews so both pickers share the same Tier-1 rule.
 */
export function dueReviews(entries = [], now = Date.now()) {
  return entries
    .filter((e) => e.surface_after && new Date(e.surface_after).getTime() <= now)
    .sort((a, b) => new Date(a.surface_after) - new Date(b.surface_after))
}

/**
 * Open (not done/dropped) menu items for one Quant strand, oldest-pulled
 * first — a rotation within the strand, not a queue anyone owes completion of.
 */
export function openMenuItems(menuItems = [], track) {
  return menuItems
    .filter((m) => m.track === track && m.status === 'open')
    .sort((a, b) => {
      if (!a.last_pulled_at) return -1
      if (!b.last_pulled_at) return 1
      return new Date(a.last_pulled_at) - new Date(b.last_pulled_at)
    })
}

/**
 * The picker. Tier 1: any due review across all tracks wins outright. Tier 2:
 * weighted-random track, then (for quant) a weighted-random strand, then the
 * least-recently-pulled open item in that strand. Dev pulls the next `todo`
 * section of the Active Concept Bank topic; Interview pulls its own due/next
 * problem (computed by interviewPlan.js — passed in, not recomputed here).
 *
 * Returns `null` if there's nothing pickable at all (every track empty) —
 * callers should fall back to FLOOR_ITEMS or an "all clear" state, never an
 * error.
 */
export function suggestNext({
  menuItems = [],
  reviewEntries = [],
  devNextSection = null,
  interviewNext = null,
  trackLastTouched = {},
  quantStrandLastTouched = {},
  now = Date.now(),
  rng = Math.random,
} = {}) {
  const due = dueReviews(reviewEntries, now)
  if (due.length) {
    return { tier: 'review', track: due[0].track ?? null, item: due[0] }
  }

  const availableTracks = TRACKS.filter((t) => {
    if (t === 'dev') return !!devNextSection
    if (t === 'interview') return !!interviewNext
    return openMenuItems(menuItems, 'quant-build').length ||
      openMenuItems(menuItems, 'quant-read').length ||
      openMenuItems(menuItems, 'quant-mental').length
  })
  if (!availableTracks.length) return null

  const track = weightedPick(staleWeights(availableTracks, trackLastTouched, now), rng)

  if (track === 'dev') return { tier: 'new', track: 'dev', item: devNextSection }
  if (track === 'interview') return { tier: 'new', track: 'interview', item: interviewNext }

  const strand = weightedPick(staleWeights(QUANT_STRANDS, quantStrandLastTouched, now), rng)
  const item = openMenuItems(menuItems, strand)[0] ?? null
  return item ? { tier: 'new', track: 'quant', strand, item } : null
}
