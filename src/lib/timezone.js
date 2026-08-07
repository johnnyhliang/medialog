// Timezone resolution and day-boundary math.
//
// Two rules this module exists to enforce:
//
//   1. The default is INFERRED from the browser, never stored. A user who has
//      not chosen a timezone should get the right answer on every machine they
//      open the app on, including one they travel with. Storing "America/
//      New_York" at signup would silently follow them to Berlin and be wrong.
//
//   2. "Today" is a question about a PLACE, not an instant. A reminder due
//      Friday is due Friday where the user is. Comparing timestamps in UTC —
//      or in whatever timezone the machine happens to be set to — makes a
//      deadline flip a day for anyone west of UTC, which is the single most
//      likely way this feature ships broken.
//
// No date library. `Intl.DateTimeFormat` ships with the IANA database in every
// browser we support, and it is the same data a library would bundle.

// Sentinel for "follow the browser". Stored in `user_configs.timezone` as NULL,
// which is also what every existing row has — so the default needs no backfill.
export const BROWSER_DEFAULT = 'browser'

export function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// What the browser thinks it is. Falls back to UTC rather than throwing: a
// clock that is wrong by hours still beats a page that fails to render.
export function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// The single entry point. Everything downstream takes a resolved IANA name, so
// the `BROWSER_DEFAULT` sentinel never leaks past this function.
//
// An invalid stored value falls back to the browser instead of throwing. A
// timezone can genuinely disappear between IANA releases, and a stale
// preference must not brick the agenda.
export function resolveTimezone(pref) {
  if (!pref || pref === BROWSER_DEFAULT) return browserTimezone()
  return isValidTimezone(pref) ? pref : browserTimezone()
}

// Wall-clock fields for an instant, as read in `tz`. This is the primitive
// everything else is built from: it answers "what does the clock on the wall
// say in Tokyo right now".
export function zonedParts(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const out = {}
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value)
  }
  // `hour12: false` renders midnight as hour 24 in some engines, not 0.
  if (out.hour === 24) out.hour = 0
  return out
}

// Offset of `tz` from UTC, in milliseconds, AT A GIVEN INSTANT.
//
// It has to be per-instant, not per-zone: a zone's offset changes at DST
// transitions, so "America/New_York is -5" is only true half the year. Asking
// at the wrong instant is a one-hour bug twice a year.
//
// The trick: format the instant in `tz`, then reinterpret those wall-clock
// fields as if they were UTC. The gap between that and the real instant IS the
// offset.
export function zoneOffsetMs(date, tz) {
  const p = zonedParts(date, tz)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000
}

// The instant corresponding to a wall-clock time in `tz`.
//
// Two passes on purpose. The first pass uses the offset in effect *now*, which
// is wrong when the target lands on the other side of a DST change — computing
// end-of-day on a spring-forward Saturday would use Saturday's offset for a
// Sunday instant. The second pass re-reads the offset at the approximate answer
// and corrects. Two passes converge for every real-world zone; a third would
// only matter for offsets that shift more than a day apart, which do not exist.
function instantFromWallClock({ year, month, day, hour, minute, second, ms = 0 }, tz, near) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  const firstGuess = new Date(naive - zoneOffsetMs(near, tz))
  return new Date(naive - zoneOffsetMs(firstGuess, tz))
}

// Last millisecond of the local day containing `now`, as a real instant.
export function endOfDayIn(now, tz) {
  const p = zonedParts(now, tz)
  return instantFromWallClock(
    { year: p.year, month: p.month, day: p.day, hour: 23, minute: 59, second: 59, ms: 999 },
    tz,
    now,
  )
}

// Last millisecond of the local day `days` ahead.
//
// `Date.UTC` normalises overflow, so day 32 of a 31-day month rolls into the
// next month without any calendar arithmetic here. That is why this can add
// days to the raw field rather than to a Date.
export function endOfDayAheadIn(now, tz, days) {
  const p = zonedParts(now, tz)
  return instantFromWallClock(
    { year: p.year, month: p.month, day: p.day + days, hour: 23, minute: 59, second: 59, ms: 999 },
    tz,
    now,
  )
}

// True when both instants fall on the same calendar day in `tz`.
export function isSameDayIn(a, b, tz) {
  const pa = zonedParts(a, tz)
  const pb = zonedParts(b, tz)
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day
}
