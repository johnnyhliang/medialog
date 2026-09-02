// DB helpers for the opportunity board's writes, and for the program watchlist
// that feeds it.
//
// The read path (the shared board merged with this user's `opportunity_state`)
// already lives in `src/lib/opportunities.jsx` as `fetchOpportunities` /
// `opportunityMutations`. What was left behind in the components was the manual
// "+ add" insert — the same twenty lines typed out twice, in OpportunityView and
// in OpportunitiesWidget — plus WatchlistTab's three program queries.
//
// Programs live here rather than in `applications.js` because they are a source
// of opportunities (the cron turns an opening window into a `program-alert`
// row), not a stage of the pipeline.

import { unwrap } from './unwrap.js'
import { requireUser } from '../requireUser.js'

// `opportunities.is_read` / `is_saved` are the LEGACY columns. Migration 0044
// moved per-user state to `opportunity_state` and left these behind, still
// defaulting to false on every insert. A freshly inserted row selected back with
// `*` therefore carries them, and both components pushed that raw row straight
// into the list — so the manual row's flags came from the wrong table. It read
// correctly only by the accident that both defaults are false and a brand-new
// row is genuinely unread. Strip them at the boundary so nothing downstream can
// start believing them.
function withUserState(row) {
  const { is_read, is_saved, ...rest } = row
  return { ...rest, is_read: false, is_saved: false }
}

/**
 * Add an opportunity by hand.
 *
 * The title is the URL's hostname: a manually-pasted link has no scraped title,
 * and the hostname is the one thing that always parses. A URL that doesn't parse
 * at all is used verbatim rather than rejected — the point of the box is to
 * capture something before it is lost.
 */
export async function createManualOpportunity(supabase, { url, note = null, tag }) {
  // requireUser, not getUserOrNull: same as any other deliberate create. It also
  // supplies `created_by`, which the `opportunities: insert own` policy checks
  // against auth.uid(). The column default would fill it too, but with no
  // session it resolves to null and the insert is refused by RLS with a message
  // about policy violations rather than about being signed out.
  const user = await requireUser(supabase)
  const trimmed = url.trim()
  const hostname = (() => { try { return new URL(trimmed).hostname } catch { return trimmed } })()
  const row = unwrap(await supabase
    .from('opportunities')
    .insert({
      source: 'manual',
      title: hostname,
      body: note || null,
      url: trimmed,
      tags: [tag],
      posted_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select()
    .single(), 'createManualOpportunity')
  return withUserState(row)
}

// The program watchlist lives in ./programs.js, not here. One module owns the
// `programs` table; splitting it across two was how ProgramsTab and
// WatchlistTab ended up with divergent copies in the first place.

