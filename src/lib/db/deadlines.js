// The banner's one read. See src/lib/deadlines.js for the rules it applies.

import { buildDeadlines, HORIZON_DAYS, CLOSED_STATUSES, todayIn } from '../deadlines.js'
import { browserTimezone } from '../timezone.js'

/**
 * Everything with a real closing date inside the horizon, from both tables.
 *
 * Filtered in the database rather than in JS: this runs on every Home render,
 * and pulling 275 opportunities' worth of sibling rows to throw almost all of
 * them away is the kind of query the app already has 18 too many of.
 */
export async function listDeadlines(supabase, { now = new Date(), tz = browserTimezone() } = {}) {
  const today = todayIn(now, tz)
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86400000)
  const until = todayIn(horizon, tz)

  const [programsRes, applicationsRes] = await Promise.all([
    supabase
      .from('programs')
      .select('id, name, url, deadline, category, window_open, last_checked')
      // Either it has a date in range, or its window is flagged open. Anything
      // else is a catalogue row and does not belong on Home.
      .or(`and(deadline.gte.${today},deadline.lte.${until}),window_open.is.true`),
    supabase
      .from('applications')
      .select('id, company, role, url, deadline, status')
      .not('deadline', 'is', null)
      .gte('deadline', today)
      .lte('deadline', until)
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`),
  ])

  if (programsRes.error) throw new Error(programsRes.error.message)
  if (applicationsRes.error) throw new Error(applicationsRes.error.message)

  return buildDeadlines({
    programs: programsRes.data ?? [],
    applications: applicationsRes.data ?? [],
    now,
    tz,
  })
}

/**
 * Mark a program's window closed.
 *
 * Exposed on the agenda row itself, not only in Settings > Programs. The whole
 * complaint that produced this was "I don't know how to change it or stop the
 * notification" — a dismissal that lives two screens away from the thing being
 * dismissed is a dismissal nobody finds. Acting where you see it is the point.
 *
 * `last_checked` moves to now as well: you just checked it, by closing it.
 */
export async function closeProgramWindow(supabase, id) {
  const { error } = await supabase
    .from('programs')
    .update({ window_open: false, last_checked: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
