// Deadline surfacing — pure. See the header of DeadlineAlertBanner.jsx for why
// this is the one place in the app allowed to be urgent.
//
// The rule that keeps it honest: only things with a REAL closing date appear.
// A rolling "applications open ~Aug 2027" is not a deadline, it is a season,
// and writing it into a date column so it can be counted down is precisely the
// alarm manager-scope §8 rules out.

import { zonedParts, browserTimezone } from './timezone.js'

// Four weeks. Long enough that a real application is not a surprise, short
// enough that the banner is empty most of the time — which is the only reason
// it can live on Home without being tuned out.
export const HORIZON_DAYS = 28

// A `window_open` flag with no date is an UNBOUNDED claim: nothing about it
// ever becomes false, so it sits on Home forever. Two programs were flagged
// open on 2026-06-20 and still read "open now" 51 days later, with no way to
// make them stop — the exact opposite of saving anyone attention.
//
// So an undated open window expires on its own. `last_checked` is when the
// scraper (or you) last confirmed it, and a claim nobody has confirmed in a
// month is not information any more. Dated windows are unaffected: they have a
// real end and do not need one invented.
export const OPEN_WINDOW_STALE_DAYS = 30

// Applications in these states are decided. A deadline on one is history, and
// counting it down would be nagging someone about a job they did not get.
export const CLOSED_STATUSES = ['offer', 'rejected', 'ghosted']

const DAY_MS = 86400000

/** `YYYY-MM-DD` today, in the user's zone — the day a countdown is measured from. */
export function todayIn(now = new Date(), tz = browserTimezone()) {
  const p = zonedParts(now, tz)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/**
 * Whole days from today to a `YYYY-MM-DD` date, in calendar days rather than
 * elapsed hours — "tomorrow" must read as 1 whether it is 23 or 25 hours away.
 * `null` for anything unparseable.
 */
export function daysUntil(dateStr, now = new Date(), tz = browserTimezone()) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return null
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const [ty, tm, td] = todayIn(now, tz).split('-').map(Number)
  const today = Date.UTC(ty, tm - 1, td)
  return Math.round((target - today) / DAY_MS)
}

/**
 * How loud a row is allowed to be. Three levels, and the loudest is still just
 * a colour — there is no modal, no sound, and no red for anything that has not
 * actually run out.
 */
export function urgencyOf(daysLeft) {
  if (daysLeft == null) return 'open'
  if (daysLeft <= 0) return 'today'
  if (daysLeft <= 7) return 'soon'
  return 'later'
}

/** "today" / "tomorrow" / "in 5 days" / "open now". Never "overdue". */
export function phraseFor(daysLeft) {
  if (daysLeft == null) return 'open now'
  if (daysLeft < 0) return 'closed'
  if (daysLeft === 0) return 'today'
  if (daysLeft === 1) return 'tomorrow'
  return `in ${daysLeft} days`
}

/**
 * Merge programs and applications into one sorted list of things with a real
 * date, dropping everything outside the horizon.
 *
 * Two tables, one list, because the distinction between "a program whose window
 * opens" and "an application I have to send" is a schema detail — from Home
 * they are both just a thing with a date.
 */
export function buildDeadlines({ programs = [], applications = [], now = new Date(), tz = browserTimezone() } = {}) {
  const rows = []

  for (const p of programs) {
    if (!p?.id) continue
    const daysLeft = daysUntil(p.deadline, now, tz)
    // A program with no date shows ONLY while its window is flagged open, and
    // only while that flag is still fresh — see OPEN_WINDOW_STALE_DAYS.
    if (daysLeft == null) {
      if (!p.window_open) continue
      const checked = daysUntil(p.last_checked, now, tz)
      if (checked == null || -checked > OPEN_WINDOW_STALE_DAYS) continue
    } else if (daysLeft < 0 || daysLeft > HORIZON_DAYS) continue

    rows.push({
      key: `program:${p.id}`,
      name: p.name,
      url: p.url || null,
      daysLeft,
      when: phraseFor(daysLeft),
      detail: p.category || null,
    })
  }

  for (const a of applications) {
    if (!a?.id || !a.deadline) continue
    if (CLOSED_STATUSES.includes(a.status)) continue
    const daysLeft = daysUntil(a.deadline, now, tz)
    if (daysLeft == null || daysLeft < 0 || daysLeft > HORIZON_DAYS) continue

    rows.push({
      key: `application:${a.id}`,
      name: a.company,
      url: a.url || null,
      daysLeft,
      when: phraseFor(daysLeft),
      detail: a.role || null,
    })
  }

  // Soonest first; open-ended windows last, since a thing with no date can
  // never be more urgent than a thing with one.
  return rows.sort((x, y) => {
    if (x.daysLeft == null) return 1
    if (y.daysLeft == null) return -1
    return x.daysLeft - y.daysLeft
  })
}
