// What each tier gets, as data.
//
// Mirrors src/lib/modules.js deliberately: modules answer "can this account SEE
// the feature", limits answer "how much of it can it USE". One editing idiom for
// both, so changing the offer is a data edit rather than a code hunt.
//
// null means UNLIMITED. Absent keys also mean unlimited, so adding a dimension
// here can never accidentally restrict an existing tier.
//
// Only dimensions with a real marginal cost are listed. Entry count is
// deliberately NOT limited — capping capture would poison the core loop at
// exactly the moment someone decides they like the app, and notes are cheap.

export const TIER_LIMITS = {
  free: {
    // 500 MB. Storage is the one dimension that grows without bound; the
    // snapshots bucket caps a single file at 25 MB, so this is ~20+ archives.
    storageBytes: 500 * 1024 * 1024,
    // Each feed is a recurring server-side fetch on a shared cron, so feed count
    // is really "how much recurring work does this account create".
    feeds: 10,
    // Minimum hours between automatic GitHub backups.
    backupIntervalHours: 24,
    // TODO(metering): set from real data once ai_usage has a week of history.
    // Guessing this now is exactly what docs/metering-scope.md warns against —
    // null keeps it unlimited and honest until then.
    aiCallsPerMonth: null,
  },
  paid: {
    storageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    feeds: 100,
    backupIntervalHours: 1,
    aiCallsPerMonth: null, // TODO(metering): same as above
  },
  founder: {
    // Everything unlimited. Listed explicitly rather than left to the fallback so
    // it is obvious this is intentional.
    storageBytes: null,
    feeds: null,
    backupIntervalHours: null,
    aiCallsPerMonth: null,
  },
}

export const LIMIT_LABELS = {
  storageBytes: 'Storage',
  feeds: 'Feed sources',
  backupIntervalHours: 'Backup frequency',
  aiCallsPerMonth: 'AI calls per month',
}

/** The limit for a tier, or null when unlimited. Unknown tier → free (least privileged). */
export function limitFor(tier, key) {
  const table = TIER_LIMITS[tier] ?? TIER_LIMITS.free
  const value = table[key]
  return value === undefined ? null : value
}

/**
 * Is `current` at or past the limit?
 *
 * Uses >= so callers can ask BEFORE adding: `isOverLimit(tier, 'feeds', count)`
 * answers "would adding one more exceed the allowance".
 */
export function isOverLimit(tier, key, current) {
  const max = limitFor(tier, key)
  if (max === null) return false
  return Number(current ?? 0) >= max
}

/** Remaining allowance, or null when unlimited. Never negative. */
export function remaining(tier, key, current) {
  const max = limitFor(tier, key)
  if (max === null) return null
  return Math.max(0, max - Number(current ?? 0))
}

export function formatBytes(n) {
  const b = Number(n ?? 0)
  if (b < 1024) return `${b} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = b / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1 }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

/** Human summary of a limit, for Settings and the upgrade affordance. */
export function describeLimit(tier, key) {
  const max = limitFor(tier, key)
  if (max === null) return 'unlimited'
  if (key === 'storageBytes') return formatBytes(max)
  if (key === 'backupIntervalHours') return max === 1 ? 'hourly' : `every ${max}h`
  return String(max)
}
