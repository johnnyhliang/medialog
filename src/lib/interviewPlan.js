// Pace and next-problem selection for the interview tracker.
//
// Pure functions over already-loaded patterns/problems — no DB, no clock reads
// except through an injected `now`, so every branch is testable. See
// docs/interview-progress-spec.md for the reasoning behind the precedence rules.
//
// The scaffolding this leans on already exists: problems are entries, so they
// carry surface_after + srs_* from the SM-2 implementation in db/entries.js.

import { patternReadiness } from './db/interview.js'

export const DEFAULT_SET_SIZE = 5
export const MAX_REVIEWS_PER_SET = 3
export const MAX_CONSECUTIVE_SAME_PATTERN = 2

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 }
const difficultyRank = (d) => DIFFICULTY_ORDER[d] ?? 1

const isSolved = (p) => p.status === 'done'

/**
 * Solved problems whose review date has passed. Retention work — these outrank
 * every unsolved problem, which is the entire point of having SM-2 in the schema.
 */
export function dueReviews(problems = [], now = Date.now()) {
  return problems
    .filter((p) => isSolved(p) && p.surface_after && new Date(p.surface_after).getTime() <= now)
    .sort((a, b) => new Date(a.surface_after) - new Date(b.surface_after))
}

/**
 * Fraction of a pattern's solved problems that are overdue for review. A pattern
 * whose every problem is overdue isn't "ready" however good its mastery once was,
 * so this is shown alongside readiness rather than folded into it — collapsing
 * them would hide which of the two is the actual problem.
 */
export function patternStaleness(problems = [], now = Date.now()) {
  const solved = problems.filter(isSolved)
  if (!solved.length) return 0
  const overdue = solved.filter(
    (p) => p.surface_after && new Date(p.surface_after).getTime() <= now
  ).length
  return overdue / solved.length
}

/**
 * Problems still to solve to hit every pattern's target. Patterns already at or
 * past target contribute zero rather than a negative.
 */
export function remainingProblems(patterns = [], problemsByTopic = {}) {
  return patterns.reduce((sum, pat) => {
    const problems = problemsByTopic[pat.id] ?? []
    const { solved, target } = patternReadiness(pat, problems)
    return sum + Math.max(0, target - solved)
  }, 0)
}

/**
 * Required vs actual problems-per-week against a target date.
 *
 * A rate converts into a decision about today in a way a completion percentage
 * never does. `no_target` is a first-class state: pace is opt-in, and without a
 * date the tracker still works and simply doesn't nag.
 */
export function paceStatus({ patterns = [], problemsByTopic = {}, targetDate = null, now = Date.now() }) {
  const remaining = remainingProblems(patterns, problemsByTopic)

  if (!targetDate) {
    return { verdict: 'no_target', remaining, weeksLeft: null, requiredRate: null, actualRate: actualWeeklyRate(problemsByTopic, now) }
  }

  const msLeft = new Date(targetDate).getTime() - now
  // A part-week still counts as a week of capacity; flooring to 0 would divide by
  // zero and report an infinite required rate on the final day.
  const weeksLeft = Math.max(msLeft / (7 * 86400000), 0.25)
  const requiredRate = remaining / weeksLeft
  const actualRate = actualWeeklyRate(problemsByTopic, now)

  if (remaining === 0) return { verdict: 'ahead', remaining, weeksLeft, requiredRate: 0, actualRate }
  if (msLeft <= 0) return { verdict: 'behind', remaining, weeksLeft, requiredRate, actualRate }

  let verdict = 'on_pace'
  if (actualRate < requiredRate * 0.9) verdict = 'behind'
  else if (actualRate > requiredRate * 1.25) verdict = 'ahead'
  return { verdict, remaining, weeksLeft, requiredRate, actualRate }
}

/**
 * Problems completed per week over the trailing fortnight. Uses whatever
 * completion timestamp the row carries, so it needs no new tracking. Two weeks
 * rather than one: a single quiet week shouldn't read as falling behind.
 */
export function actualWeeklyRate(problemsByTopic = {}, now = Date.now()) {
  const cutoff = now - 14 * 86400000
  let done = 0
  for (const problems of Object.values(problemsByTopic)) {
    for (const p of problems ?? []) {
      if (!isSolved(p)) continue
      const at = p.completed_at ?? p.updated_at ?? null
      if (at && new Date(at).getTime() >= cutoff) done += 1
    }
  }
  return done / 2
}

/**
 * Turns a focus list into the weights `suggestNext` consumes.
 *
 * This is the pivot lever: change focus and readiness ordering, gaps and
 * suggestions all shift without touching a single problem. No focus means every
 * track weighted equally — the honest default before you've decided what you're
 * interviewing for, rather than silently guessing one.
 */
export function trackWeightsFromFocus(focus = [], { focused = 3, other = 1 } = {}) {
  if (!focus?.length) return { __default: other }
  const out = { __default: other }
  for (const track of focus) out[track] = focused
  return out
}

/**
 * Ranked gaps with a machine-readable reason each, so the UI can explain *why*
 * something is a gap instead of only showing a low number.
 *
 * Three distinct kinds, because they need different responses:
 *   'uncovered' — below target, needs new problems
 *   'stale'     — covered, but reviews are overdue; needs recall not volume
 *   'shaky'     — covered and reviewed, but mastery is low; needs re-learning
 *
 * Collapsing these into one "readiness" number is what makes a tracker feel
 * accusatory rather than useful: it tells you you're behind without telling you
 * what to do.
 */
export function identifyGaps({ patterns = [], problemsByTopic = {}, focus = [], now = Date.now(), limit = 5 } = {}) {
  const weights = trackWeightsFromFocus(focus)
  const inFocus = (pat) => !focus?.length || (pat.tracks ?? []).some((t) => focus.includes(t))

  const gaps = patterns.map((pat) => {
    const problems = problemsByTopic[pat.id] ?? []
    const { coverage, mastery, ready, solved, target } = patternReadiness(pat, problems)
    const stale = patternStaleness(problems, now)
    const weight = Math.max(
      ...[...(pat.tracks ?? [])].map((t) => weights[t] ?? 1),
      weights.__default ?? 1
    )

    let kind = null
    if (coverage < 1) kind = 'uncovered'
    else if (stale >= 0.5) kind = 'stale'
    else if (mastery < 0.6) kind = 'shaky'
    if (!kind) return null

    // Severity is scaled by focus weight so a pivot immediately reorders the
    // list — an untouched pattern outside your focus shouldn't outrank a shaky
    // one inside it.
    const severity = (1 - ready) * weight * (inFocus(pat) ? 1 : 0.4)
    return {
      patternId: pat.id,
      name: pat.name,
      kind,
      severity,
      coverage,
      mastery,
      stale,
      missing: Math.max(0, target - solved),
      inFocus: inFocus(pat),
    }
  }).filter(Boolean)

  return gaps.sort((a, b) => b.severity - a.severity).slice(0, limit)
}

// How badly a pattern needs work. Recency penalty spreads a session across
// patterns instead of letting it tunnel into whichever one scores highest once.
function patternNeed(pattern, problems, { trackWeights, now }) {
  const readiness = patternReadiness(pattern, problems).ready
  const weight = Math.max(
    ...[...(pattern.tracks ?? [])].map((t) => trackWeights[t] ?? 1),
    trackWeights.__default ?? 1
  )
  const touchedToday = (problems ?? []).some(
    (p) => p.updated_at && now - new Date(p.updated_at).getTime() < 86400000
  )
  return (1 - readiness) * weight * (touchedToday ? 0.6 : 1)
}

/**
 * Today's finite set: due reviews first, then the weakest pattern's easiest
 * unsolved problem, with anti-tunnelling gates.
 *
 * Returns at most `size` items. A short or empty list is the success state, not a
 * failure — "you're caught up" is the whole design goal (see
 * docs/intentional-app-spec.md Part 3), so callers must not pad it.
 */
export function suggestNext({
  patterns = [],
  problemsByTopic = {},
  trackWeights = {},
  size = DEFAULT_SET_SIZE,
  now = Date.now(),
} = {}) {
  const out = []

  // Tier 1 — due reviews, capped so retention work can't consume the whole set.
  const allProblems = patterns.flatMap((p) => problemsByTopic[p.id] ?? [])
  for (const p of dueReviews(allProblems, now).slice(0, MAX_REVIEWS_PER_SET)) {
    if (out.length >= size) break
    out.push({ problem: p, reason: 'review', patternId: p.topic_id })
  }

  // Tier 2 — unsolved work, re-scored each pick so the recency penalty and the
  // consecutive-pattern gate actually take effect within one set.
  const used = new Set(out.map((x) => x.problem.id))

  while (out.length < size) {
    const candidates = patterns
      .map((pat) => {
        const problems = problemsByTopic[pat.id] ?? []
        const { coverage } = patternReadiness(pat, problems)
        // A pattern at full coverage only earns a slot through due reviews,
        // which Tier 1 already handled.
        if (coverage >= 1) return null
        const unsolved = problems
          .filter((p) => !isSolved(p) && !used.has(p.id))
          .sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty))
        if (!unsolved.length) return null
        return { pattern: pat, problem: unsolved[0], need: patternNeed(pat, problems, { trackWeights, now }) }
      })
      .filter(Boolean)

    if (!candidates.length) break

    // Difficulty is a ladder, not a filter: within the neediest pattern we take
    // the easiest unsolved problem rather than the hardest available.
    candidates.sort((a, b) => b.need - a.need)

    const tail = out.slice(-MAX_CONSECUTIVE_SAME_PATTERN)
    const blocked = tail.length === MAX_CONSECUTIVE_SAME_PATTERN
      && new Set(tail.map((x) => x.patternId)).size === 1
      ? tail[0].patternId
      : null

    const pick = candidates.find((c) => c.pattern.id !== blocked) ?? candidates[0]
    out.push({ problem: pick.problem, reason: 'new', patternId: pick.pattern.id })
    used.add(pick.problem.id)
  }

  return out
}
