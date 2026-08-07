// Agenda grouping — pure date arithmetic, no database.
//
// `docs/intentional-app-spec.md` Part 1 asks for a time-grouped list of
// Overdue / Today / This week / Later. That grouping is the whole "calm and
// bounded" promise: four named buckets you can finish reading, not a scroll.
//
// This module takes the flat list `listAgenda()` returns and splits it. It is
// separate from the query on purpose — grouping by "today" depends on the
// user's clock and timezone, which is exactly the kind of logic that should be
// testable against a fixed date instead of a mocked database.

import { browserTimezone, endOfDayAheadIn, zonedParts } from './timezone.js'

export const BUCKETS = ['overdue', 'today', 'week', 'later']

export const BUCKET_LABELS = {
  overdue: 'Overdue',
  today: 'Today',
  week: 'This week',
  later: 'Later',
}

// Every function here takes an explicit `tz`, resolved by the caller through
// `resolveTimezone()`. Nothing in this module reads the machine clock's zone,
// because "today" has to mean today WHERE THE USER IS — including when they
// have overridden it to somewhere they are not.
//
// The week window is seven days out, not "end of the calendar week". A Monday
// agenda and a Friday agenda should both show a week of runway; a calendar week
// would leave Friday showing almost nothing under "This week".
const WEEK_DAYS = 7

// A sortable integer for a calendar day, e.g. 2026-08-07 → 20260807. Comparing
// these compares DAYS, which is the whole point below.
function dayNumber(date, tz) {
  const p = zonedParts(date, tz)
  return p.year * 10000 + p.month * 100 + p.day
}

// Overdue means "a day that has already ended", not "a moment that has already
// passed".
//
// The alternative — comparing raw instants — reads as obviously correct and is
// wrong in practice. Most reminders get a date but no meaningful time, which
// stores as local midnight, so an instant comparison marks everything due today
// as overdue at 00:01 and the agenda opens shouting on a day you have not
// started. Even for a reminder with a real time on it, a 9am task is not a
// failure at 9:05; it is a thing to do today.
//
// So the day is the unit: nothing due today is ever overdue, and everything
// rolls over together at local midnight. That is also what makes the bucket
// stable — an entry does not silently move from Today to Overdue while you are
// looking at it.
export function bucketFor(dueAt, now = new Date(), tz = browserTimezone()) {
  if (!dueAt) return null
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return null

  const dueDay = dayNumber(due, tz)
  const todayDay = dayNumber(now, tz)

  if (dueDay < todayDay) return 'overdue'
  if (dueDay === todayDay) return 'today'
  if (due <= endOfDayAheadIn(now, tz, WEEK_DAYS)) return 'week'
  return 'later'
}

// Returns every bucket, including empty ones, so a caller can render "nothing
// overdue" as a real, reassuring statement rather than by silently omitting the
// section. Closure states are a feature here, not an absence — the spec's
// "you're caught up" end state depends on being able to say a bucket is empty.
export function groupAgenda(entries, now = new Date(), tz = browserTimezone()) {
  const groups = { overdue: [], today: [], week: [], later: [] }
  for (const entry of entries || []) {
    const bucket = bucketFor(entry.due_at, now, tz)
    if (bucket) groups[bucket].push(entry)
  }
  return groups
}

// The Needs-attention banner (build order step 3) wants a count, not a list.
export function overdueCount(entries, now = new Date(), tz = browserTimezone()) {
  return groupAgenda(entries, now, tz).overdue.length
}

export function isAgendaEmpty(groups) {
  return BUCKETS.every((b) => groups[b].length === 0)
}
