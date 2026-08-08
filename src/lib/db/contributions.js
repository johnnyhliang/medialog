// Contribution grid reads/writes. See docs/manager-scope.md §6.
//
// Follows the db-layer convention: `supabase` is injected as the first argument
// so tests pass a mock, and every function throws a plain Error on failure
// rather than returning a { data, error } pair for callers to re-check.

import { todayKey } from '../contributions.js'
import { browserTimezone } from '../timezone.js'

/**
 * Rows for the grid window. `days` back from today, inclusive.
 *
 * Selects only what the grid draws. `note` comes along because a square with no
 * explanation is a square you cannot trust — hovering one must be able to say
 * what it was.
 */
export async function listContributions(supabase, { days = 200, now = new Date(), tz = browserTimezone() } = {}) {
  const since = new Date(now.getTime() - days * 86400000)
  const { data, error } = await supabase
    .from('contributions')
    .select('id, day, topic_id, kind, note')
    .gte('day', todayKey(since, tz))
    .order('day', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Record one contribution.
 *
 * `day` is resolved in the user's timezone, not UTC: work done at 9pm belongs
 * on tonight's square, and a UTC day boundary would move it to tomorrow for
 * anyone west of Greenwich.
 *
 * Deliberately fire-and-forget at the call sites: a failed grid write must
 * never block or roll back the thing that actually happened (a checkbox flip,
 * an entry marked done). The grid is a record of work, not the work.
 */
export async function recordContribution(supabase, { topicId = null, kind, note = null, now = new Date(), tz = browserTimezone() }) {
  const { error } = await supabase
    .from('contributions')
    .insert({ day: todayKey(now, tz), topic_id: topicId, kind, note })
  if (error) throw new Error(error.message)
}

/**
 * Undo today's contribution for a specific thing — unchecking a box, or moving
 * an entry back out of done.
 *
 * Scoped to today on purpose. Un-ticking something you finished last week is
 * editing a plan, not undoing today's work, and silently deleting an old square
 * would make the grid quietly lie about a day you did live through.
 *
 * `note` identifies which one: the step text or entry title recorded on write.
 * Matching on it is why the column is denormalised.
 */
export async function unrecordContribution(supabase, { kind, note, now = new Date(), tz = browserTimezone() }) {
  let query = supabase
    .from('contributions')
    .delete()
    .eq('day', todayKey(now, tz))
    .eq('kind', kind)
  query = note == null ? query.is('note', null) : query.eq('note', note)
  const { error } = await query
  if (error) throw new Error(error.message)
}
