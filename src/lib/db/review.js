// The Home screen's read-only "how am I doing" queries: the review summary
// badges, the focus card, and the resurfaced highlights.
//
// These lived inline in three components — `HomeReviewSummary` alone held seven
// `.from()` calls, the densest cluster left in the app — and every one of them
// read `res.data ?? []` or `res.count ?? 0`, so a failed query rendered as a
// clean inbox, no active work, and nothing worth resurfacing. Home is the first
// screen after sign-in; "everything is fine" is the single worst thing for it
// to say when the database is unreachable.
//
// No auth helper in this module. Same reasoning as `conversations.js` and
// `tidy.js`: nothing here interpolates a `user.id` into a filter — `entries`,
// `topics` and `highlights` are all scoped by RLS on `auth.uid()` — so there is
// no `user_id: undefined` failure mode for `requireUser` to catch. And these
// are exactly the paths `getUserOrNull` describes (a widget that mounts before
// the session settles), so adding a *throwing* helper here would be a
// regression; adding a non-throwing one that nothing reads would be noise.

import { unwrap, unwrapList } from './unwrap.js'

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

// Same string as entries.js and tidy.js. See the note there: this filter is the
// one this codebase re-types per call site and gets wrong.
const NOT_SNOOZED = 'surface_after.is.null,surface_after.lte.now()'

// `unwrap` for a `head: true` count query. The count rides on the response
// beside `data` (which is null by design for a head request), so `unwrap`'s
// return value is useless here — but its throw is exactly what is wanted, and
// running it first is what keeps a failure from arriving as the number 0.
function unwrapCount(result, context) {
  unwrap(result, context)
  return result?.count ?? 0
}

/**
 * The five numbers behind the Home review badges.
 *
 * BUGS FIXED, both of the re-typed-filter kind:
 *
 *  1. None of the four entry counts applied the snooze guard its siblings in
 *     `entries.js` apply. Snoozing an entry is the user saying "not now", and
 *     it hid the row everywhere except the badge on the home screen that keeps
 *     telling them to go deal with it.
 *  2. The `inbox` count had no `status != 'done'` filter, while `oldInbox` —
 *     built three lines away, over the same topic — did. Finished reading left
 *     in the Inbox kept inflating the badge, and `recommendedAction` reported
 *     it as "N items waiting in inbox" when nothing was waiting. Tidy's own
 *     inbox queue excludes done rows, so the badge counted cards that the
 *     triage surface would never show.
 *
 * The dormant-topics query is deliberately NOT snooze-filtered: it asks "did
 * anything happen in this topic recently", and an entry being scheduled for
 * later is still something that happened. Filtering it would report actively
 * maintained topics as dormant.
 */
export async function getReviewCounts(supabase) {
  const now = Date.now()
  const fourteenDaysAgo = new Date(now - FOURTEEN_DAYS).toISOString()
  const thirtyDaysAgo = new Date(now - THIRTY_DAYS).toISOString()

  const [inboxTopicResult, staleResult, activeResult, recentResult, allTopicsResult] =
    await Promise.all([
      supabase.from('topics').select('id').eq('name', 'Inbox').maybeSingle(),
      supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'backlog')
        .lt('updated_at', thirtyDaysAgo)
        .is('deleted_at', null)
        .or(NOT_SNOOZED),
      supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('deleted_at', null)
        .or(NOT_SNOOZED),
      supabase
        .from('entries')
        .select('topic_id')
        .gte('updated_at', thirtyDaysAgo)
        .is('deleted_at', null),
      supabase.from('topics').select('id').is('archived_at', null),
    ])

  // `maybeSingle` on a missing Inbox topic returns `{ data: null }` without an
  // error, so a null id here really does mean "no Inbox topic", not a failure.
  const inboxTopicId = unwrap(inboxTopicResult, 'getReviewCounts(inbox topic)')?.id ?? null
  const staleBacklog = unwrapCount(staleResult, 'getReviewCounts(stale backlog)')
  const active = unwrapCount(activeResult, 'getReviewCounts(active)')
  const recentRows = unwrapList(recentResult, 'getReviewCounts(recent topics)')
  const allTopics = unwrapList(allTopicsResult, 'getReviewCounts(all topics)')

  const [inboxResult, oldInboxResult] = await Promise.all([
    inboxTopicId
      ? supabase
          .from('entries')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', inboxTopicId)
          .neq('status', 'done')
          .is('deleted_at', null)
          .or(NOT_SNOOZED)
      : Promise.resolve({ count: 0, error: null }),
    inboxTopicId
      ? supabase
          .from('entries')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', inboxTopicId)
          .lt('created_at', fourteenDaysAgo)
          .neq('status', 'done')
          .is('deleted_at', null)
          .or(NOT_SNOOZED)
      : Promise.resolve({ count: 0, error: null }),
  ])

  const recentTopicIds = new Set(recentRows.map((r) => r.topic_id))

  return {
    inbox: unwrapCount(inboxResult, 'getReviewCounts(inbox)'),
    oldInbox: unwrapCount(oldInboxResult, 'getReviewCounts(old inbox)'),
    staleBacklog,
    active,
    dormant: allTopics.filter((t) => !recentTopicIds.has(t.id)).length,
  }
}

/**
 * The one entry in flight, or null.
 *
 * Null is a real answer here — "nothing is active" is the widget's documented
 * empty state — which is precisely why the failure had to stop looking like it.
 *
 * BUG FIXED: no snooze guard, unlike `listReadingQueue` which reads the same
 * `status` column. An active entry snoozed for a month stayed pinned to the top
 * of Home as the thing to do next.
 */
export async function getFocusEntry(supabase) {
  const result = await supabase
    .from('entries')
    .select('id, title, url, topic_id, topics(name, master_doc)')
    .eq('status', 'active')
    .is('deleted_at', null)
    .or(NOT_SNOOZED)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
  return unwrapList(result, 'getFocusEntry')[0] ?? null
}

const RESURFACE_POOL = 200

/**
 * Highlights saved more than 30 days ago, for the archive resurfacer.
 *
 * Returns a pool rather than the day's picks: which two to show is seeded
 * rotation, pure arithmetic over the rows, and testing it should not need a
 * database.
 *
 * BUG FIXED: the join to `entries` had no `deleted_at is null`, so quotes from
 * trashed entries kept resurfacing and clicking one opened the reader on an
 * entry the user had deleted. `listAllHighlights` in `highlights.js` had the
 * identical bug and fixed it the same way — `!inner` is required, because with
 * the default left join PostgREST satisfies the filter by nulling the embedded
 * entry instead of dropping the row, which would leave an orphaned quote with
 * no source to open.
 */
export async function listResurfaceHighlights(supabase, limit = RESURFACE_POOL) {
  const cutoff = new Date(Date.now() - THIRTY_DAYS).toISOString()
  const result = await supabase
    .from('highlights')
    .select('id, text, created_at, entries!inner(id, title, url)')
    .is('entries.deleted_at', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(limit)
  return unwrapList(result, 'listResurfaceHighlights')
}
