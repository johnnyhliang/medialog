// The contribution grid, as pure functions. See docs/manager-scope.md §6.
//
// A log, not a streak. Everything here derives from rows that already exist —
// nothing is stored, so nothing can drift. Never throws on bad input: a grid
// that crashes on a malformed row is worse than a grid with a gap.
//
// NON-GOALS, enforced by review rather than by types (gains-system.md's
// guardrails, same list gainsPicker.js carries):
//   * no "behind" — there is no target to be behind. This is what happened.
//   * no goal/quota per day — a quota turns a dead day into a failure, which is
//     the exact feeling the dead-day floor exists to prevent.
//   * no weighting — every contribution counts one.

import { zonedParts, browserTimezone } from './timezone.js'

const DAY_MS = 86400000

/**
 * `YYYY-MM-DD` for an instant, in the given zone. `null` for anything that is
 * not a real date — `Intl` throws on an Invalid Date, and one malformed row
 * must not take the whole grid down with it.
 */
export function dayKey(date, tz = browserTimezone()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  const p = zonedParts(d, tz)
  const mm = String(p.month).padStart(2, '0')
  const dd = String(p.day).padStart(2, '0')
  return `${p.year}-${mm}-${dd}`
}

/** Today's key. Split out so callers never build a Date just to ask. */
export function todayKey(now = new Date(), tz = browserTimezone()) {
  return dayKey(now, tz)
}

/** Step a `YYYY-MM-DD` key by whole days, staying on calendar days (no DST drift). */
export function shiftKey(key, days) {
  const [y, m, d] = key.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * DAY_MS
  const out = new Date(t)
  const mm = String(out.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(out.getUTCDate()).padStart(2, '0')
  return `${out.getUTCFullYear()}-${mm}-${dd}`
}

/**
 * rows -> { 'YYYY-MM-DD': count }.
 *
 * `day` arrives as a Postgres `date`, which PostgREST serialises as a bare
 * `YYYY-MM-DD` string — already the local day, already the key. Rows carrying a
 * full timestamp (or a Date) are converted through `tz` rather than dropped, so
 * a caller that passes raw timestamps still gets a correct grid.
 */
export function countsByDay(rows = [], tz = browserTimezone()) {
  const counts = {}
  for (const row of rows) {
    const raw = row?.day
    if (!raw) continue
    let key
    if (typeof raw === 'string') {
      key = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : dayKey(new Date(raw), tz)
    } else if (raw instanceof Date) {
      key = dayKey(raw, tz)
    } else continue
    if (!key) continue
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/**
 * Five buckets, GitHub-style: 0 plus four filled levels.
 *
 * Fixed thresholds rather than percentiles of your own history. Relative
 * shading means a quiet month recolours a busy one and the grid stops meaning
 * anything across time — and it would make a good day look pale simply because
 * a better day exists.
 */
export function intensity(count) {
  if (!count || count < 1) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

/**
 * A grid of whole weeks ending on the week containing `now`, oldest week first,
 * each week Sunday→Saturday. Trailing days after today are returned with
 * `future: true` so the UI can render them as blanks rather than dead days —
 * an unlived day must not look like a day you missed.
 */
export function buildGrid(rows = [], { weeks = 26, now = new Date(), tz = browserTimezone() } = {}) {
  const counts = countsByDay(rows, tz)
  const today = todayKey(now, tz)

  // Walk back to the Sunday of the current week, then back `weeks - 1` more.
  const p = zonedParts(now, tz)
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  const start = shiftKey(today, -dow - (weeks - 1) * 7)

  const grid = []
  let key = start
  for (let w = 0; w < weeks; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const count = counts[key] ?? 0
      week.push({ key, count, level: intensity(count), future: key > today })
      key = shiftKey(key, 1)
    }
    grid.push(week)
  }
  return grid
}

/**
 * Consecutive days ending today (or yesterday) with at least one contribution.
 *
 * Yesterday counts as the anchor so the number does not read as broken at 9am
 * before you have done anything — §6 allows a streak only if it is small and
 * never the primary reading, and a counter that resets every midnight is a
 * counter that punishes you for waking up.
 */
export function currentStreak(rows = [], { now = new Date(), tz = browserTimezone() } = {}) {
  const counts = countsByDay(rows, tz)
  const today = todayKey(now, tz)
  let cursor = counts[today] ? today : shiftKey(today, -1)
  let streak = 0
  while (counts[cursor]) {
    streak++
    cursor = shiftKey(cursor, -1)
  }
  return streak
}

/** Total contributions in the window the grid covers. */
export function totalIn(grid = []) {
  return grid.reduce((sum, week) => sum + week.reduce((s, d) => s + d.count, 0), 0)
}

/** Distinct days with at least one contribution, for "N active days". */
export function activeDays(grid = []) {
  return grid.reduce((sum, week) => sum + week.filter((d) => d.count > 0).length, 0)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Month labels for the grid header: `{ index, label }` per week that starts a
 * new month. The first week is skipped unless it genuinely begins a month, so
 * a partial leading month does not get a label that overhangs the grid edge.
 */
export function monthLabels(grid = []) {
  const labels = []
  let lastMonth = null
  grid.forEach((week, index) => {
    const month = Number(week[0].key.slice(5, 7))
    if (month !== lastMonth) {
      if (lastMonth !== null || Number(week[0].key.slice(8, 10)) <= 7) {
        labels.push({ index, label: MONTHS[month - 1] })
      }
      lastMonth = month
    }
  })
  return labels
}
