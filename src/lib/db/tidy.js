// The Tidy queue: the finite, one-card-at-a-time list of entries that need a
// decision. It lived inside TidyView.jsx as a module-private `fetchTidyQueue`,
// which is why the app's single triage surface was also the only view with no
// test file — there was nothing importable to test, and the two `.from()` calls
// were reachable only by rendering the component.
//
// No auth helper here. Like `conversations.js`, this builds no `user_id`
// filter: `entries` is scoped by RLS on `auth.uid()`, so there is no
// `user_id: undefined` to interpolate and nothing for `requireUser` to guard.
// Calling it would only add a new way for the Home screen to throw while the
// session is still settling — a behaviour change, not a fix.

import { unwrapList } from './unwrap.js'

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
const QUEUE_LIMIT = 30

// The snooze guard, spelled the same way as every list query in entries.js.
// "Show me this in 30 days" has to mean the same thing on every surface.
const NOT_SNOOZED = 'surface_after.is.null,surface_after.lte.now()'

/**
 * Every inbox item (oldest first), then stale backlog, deduped.
 *
 * Rows come back tagged with `tidySource` ('inbox' | 'stale') and the date the
 * reason should be phrased against, rather than a finished sentence: the
 * wording is presentation and belongs in the view, and keeping it there lets
 * this be asserted on without matching English.
 *
 * BUG FIXED — both halves were missing the snooze guard that every sibling
 * query in `entries.js` applies (`listEntriesByTopic`, `listReadingQueue`,
 * `listForRevisit`, `listAgenda`, …). The consequence was not cosmetic: Tidy's
 * own "snooze 30d" button writes `surface_after`, and the entry it snoozed came
 * straight back at the top of the queue on the next visit. The one action that
 * is supposed to remove a card from this surface was the one action that did
 * nothing to it.
 */
export async function listTidyQueue(supabase, inboxTopicId) {
  const staleCutoff = new Date(Date.now() - THIRTY_DAYS).toISOString()

  const [inboxResult, staleResult] = await Promise.all([
    // No inbox topic yet (a brand-new account) is an ordinary state, not a
    // failure — skip the query rather than filtering on `topic_id: null`,
    // which would match nothing but still cost a round trip.
    inboxTopicId
      ? supabase
          .from('entries')
          .select('*, topics(name)')
          .eq('topic_id', inboxTopicId)
          .neq('status', 'done')
          .is('deleted_at', null)
          .or(NOT_SNOOZED)
          .order('created_at', { ascending: true })
          .limit(QUEUE_LIMIT)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('entries')
      .select('*, topics(name)')
      .eq('status', 'backlog')
      .lt('updated_at', staleCutoff)
      .is('deleted_at', null)
      .or(NOT_SNOOZED)
      .order('updated_at', { ascending: true })
      .limit(QUEUE_LIMIT),
  ])

  // Both halves were previously read as `res.data ?? []`, so a failed query
  // and an empty queue arrived as the same thing: "all tidy". The reward
  // screen for having nothing left to decide was also what a broken database
  // looked like.
  const inboxRows = unwrapList(inboxResult, 'listTidyQueue(inbox)')
  const staleRows = unwrapList(staleResult, 'listTidyQueue(stale)')

  const seen = new Set()
  const queue = []
  for (const e of inboxRows) {
    seen.add(e.id)
    queue.push({ ...e, tidySource: 'inbox', tidySince: e.created_at })
  }
  for (const e of staleRows) {
    // An inbox row can also be stale backlog. It is already queued as an inbox
    // item, and the inbox framing is the more actionable of the two.
    if (seen.has(e.id) || e.topic_id === inboxTopicId) continue
    queue.push({ ...e, tidySource: 'stale', tidySince: e.updated_at })
  }
  return queue
}
