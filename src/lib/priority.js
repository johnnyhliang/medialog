// What to do next, and whether the week fits.
//
// Pure date and set arithmetic over agenda entries, deliberately kept out of
// the MCP server and out of any component so it can be tested against a fixed
// clock without a database — same reason `agenda.js` exists separately.
//
// The design constraint is that this must be trustworthy while half-asleep. So
// the ordering is a fixed ladder decided in advance, not a score: every result
// carries the rule that selected it, and a human can check the rule rather than
// audit a weighting. A ranked list of twenty items would recreate the problem
// it is meant to solve, so callers get three.

import { bucketFor } from './agenda.js'

// Tags are how an entry declares its own urgency class. Free-text tags already
// exist on entries, so this needs no schema of its own.
export const TAG_GATING = 'gating'
export const TAG_WAITING = 'waiting'
export const TAG_SELF_PACED = 'selfpaced'

// When nothing is estimated, assume an hour. Callers are told how many entries
// fell back to this so the totals can be read with the right suspicion.
export const DEFAULT_ESTIMATE_MINUTES = 60

const HOUR = 60 * 60 * 1000

export const TIERS = {
  IMMINENT: 1,
  GATING: 2,
  BLOCKING_OTHERS: 3,
  HARDEST_COURSE: 4,
  SCHEDULED: 5,
  SELF_PACED: 6,
}

const TIER_REASONS = {
  [TIERS.IMMINENT]: 'due within 48 hours',
  [TIERS.GATING]: 'gating — something else stays locked until this is done',
  [TIERS.BLOCKING_OTHERS]: 'someone else is blocked on you',
  [TIERS.HARDEST_COURSE]: 'the course most likely to hurt',
  [TIERS.SCHEDULED]: 'next by deadline',
  [TIERS.SELF_PACED]: 'self-paced — fills leftover slack only',
}

function hasTag(entry, tag) {
  return (entry.tags || []).some((t) => String(t).toLowerCase() === tag)
}

function isDone(entry) {
  return entry.status === 'done'
}

/**
 * Which rung of the ladder an entry sits on. Order matters: the first match
 * wins, so a gating item due in three weeks still outranks a routine one due
 * tomorrow — that is intentional, gating items are small and unblock others.
 *
 * `hardestCourse` is passed in rather than hardcoded so the rule survives a
 * change of schedule.
 */
export function tierFor(entry, now = new Date(), { hardestCourse = null } = {}) {
  // Self-paced is checked first and demotes unconditionally. Work with no
  // external deadline will otherwise borrow urgency from a date someone typed
  // optimistically, and then displace work that genuinely cannot move.
  if (hasTag(entry, TAG_SELF_PACED)) return TIERS.SELF_PACED

  if (entry.due_at) {
    const remaining = new Date(entry.due_at).getTime() - now.getTime()
    if (remaining <= 48 * HOUR) return TIERS.IMMINENT
  }

  if (hasTag(entry, TAG_GATING)) return TIERS.GATING
  if (hasTag(entry, TAG_WAITING)) return TIERS.BLOCKING_OTHERS

  if (hardestCourse && entry.topicName && entry.topicName.includes(hardestCourse)) {
    return TIERS.HARDEST_COURSE
  }

  return TIERS.SCHEDULED
}

export function reasonFor(tier) {
  return TIER_REASONS[tier] ?? 'scheduled'
}

/**
 * The morning call. At most `limit` entries, each carrying the rule that chose
 * it, so an override is a judgement about the rule rather than a fight with a
 * black box.
 */
export function rankTasks(entries, now = new Date(), options = {}) {
  const { limit = 3, hardestCourse = null, timezone } = options

  const ranked = entries
    .filter((entry) => !isDone(entry))
    .map((entry) => {
      const tier = tierFor(entry, now, { hardestCourse })
      return {
        id: entry.id,
        title: entry.title,
        topic: entry.topicName ?? null,
        due_at: entry.due_at ?? null,
        bucket: entry.due_at ? bucketFor(entry.due_at, now, timezone) : null,
        tier,
        reason: reasonFor(tier),
      }
    })
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier
      // Undated work sorts last inside its tier: a real date is information,
      // its absence is not a claim to go first.
      if (a.due_at && b.due_at) return new Date(a.due_at) - new Date(b.due_at)
      if (a.due_at) return -1
      if (b.due_at) return 1
      return 0
    })

  return { total: ranked.length, next: ranked.slice(0, limit) }
}

function estimateMinutes(entry) {
  const n = Number(entry.estimate_minutes)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * The Sunday question, which is not "what should I do" but "does this week fit".
 *
 * Returns the shortfall in hours and a concrete cut list when it does not.
 * Cuts are drawn from the bottom of the ladder upward and never include tier 1
 * or 2 — an imminent deadline and a gating item are not negotiable, and a tool
 * that suggested dropping them would be worth ignoring entirely.
 */
export function assessWeek(entries, availableHours, now = new Date(), options = {}) {
  const { hardestCourse = null, horizonDays = 7 } = options
  const horizon = now.getTime() + horizonDays * 24 * HOUR

  const due = entries
    .filter((entry) => !isDone(entry) && entry.due_at)
    .filter((entry) => new Date(entry.due_at).getTime() <= horizon)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      topic: entry.topicName ?? null,
      due_at: entry.due_at,
      tier: tierFor(entry, now, { hardestCourse }),
      minutes: estimateMinutes(entry) ?? DEFAULT_ESTIMATE_MINUTES,
      estimated: estimateMinutes(entry) !== null,
    }))

  const requiredMinutes = due.reduce((sum, e) => sum + e.minutes, 0)
  const availableMinutes = Math.max(0, Number(availableHours) || 0) * 60
  const deficitMinutes = requiredMinutes - availableMinutes

  const toHours = (m) => Math.round((m / 60) * 10) / 10

  const result = {
    horizon_days: horizonDays,
    deliverables: due.length,
    unestimated: due.filter((e) => !e.estimated).length,
    required_hours: toHours(requiredMinutes),
    available_hours: toHours(availableMinutes),
    fits: deficitMinutes <= 0,
    deficit_hours: toHours(Math.max(0, deficitMinutes)),
    cuts: [],
  }

  if (result.fits) return result

  // Lowest priority first, and within a tier the latest deadline first — the
  // thing with the most room to move is the thing to move.
  const candidates = due
    .filter((e) => e.tier > TIERS.GATING)
    .sort((a, b) => (b.tier - a.tier) || (new Date(b.due_at) - new Date(a.due_at)))

  let reclaimed = 0
  for (const candidate of candidates) {
    if (reclaimed >= deficitMinutes) break
    reclaimed += candidate.minutes
    result.cuts.push({
      id: candidate.id,
      title: candidate.title,
      topic: candidate.topic,
      due_at: candidate.due_at,
      hours: toHours(candidate.minutes),
      reason: reasonFor(candidate.tier),
    })
  }

  result.reclaimed_hours = toHours(reclaimed)
  // Honesty when the cut list cannot close the gap: everything deferrable has
  // already been deferred and the week is still over capacity. That is a real
  // answer and the caller needs to hear it rather than a shorter list.
  result.still_short_hours = toHours(Math.max(0, deficitMinutes - reclaimed))

  return result
}
