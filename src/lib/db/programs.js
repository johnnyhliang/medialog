import { unwrap, unwrapList } from './unwrap.js'

// The `programs` table behind Settings -> Programs: fellowships, cohorts and
// internships with an application window and a deadline.
//
// These queries lived inline in ProgramsTab.jsx, where the load path did
// `if (data) setPrograms(data)` — the same lie `unwrap` exists to kill, since a
// failed read and an empty table both rendered as "you have no programs". The
// writes are the more consequential half: this tab saves on change rather than
// behind a Save button, so a rejected update has nothing to visibly fail. See
// docs/tech-debt.md § Reported UX problems item 5.
//
// Every function here THROWS on failure. That is load-bearing for the tab: the
// caller's catch is what triggers the re-read that makes the UI match the
// database again.

// TWO SURFACES, ONE TABLE. Settings -> Programs is a catalogue ordered by name
// and writes category/deadline/window_open. The career Watchlist is a queue
// ordered by opening date and writes opens_at. Both are legitimate and both
// predate this module — they were separate inline copies in ProgramsTab and
// WatchlistTab, which is exactly the drift item 20b exists to stop. They are
// kept as distinct named functions rather than merged into one call with six
// optional fields, because the merge would hide that `window_open: false` is
// set by one path and not the other.

export async function listPrograms(supabase) {
  const result = await supabase.from('programs').select('*').order('name')
  return unwrapList(result, 'listPrograms')
}

/** The watchlist's view of the same table: soonest opening first. */
export async function listWatchlistPrograms(supabase) {
  return unwrapList(await supabase
    .from('programs')
    .select('*')
    .order('opens_at', { ascending: true, nullsFirst: false }), 'listWatchlistPrograms')
}

/**
 * Add a program to the career watchlist.
 *
 * No requireUser, unlike the entry/application creates: `programs` is shared
 * reference data with no owner column (0044, restated by 0077), so there is
 * nothing to stamp. Being signed out surfaces as the RLS refusal from
 * `programs: insert for authenticated`, which unwrap now reports instead of
 * dropping — the actual regression this call site had.
 */
export async function createWatchlistProgram(supabase, { name, url, notes = null, opens_at = null }) {
  return unwrap(await supabase
    .from('programs')
    .insert({
      name: name.trim(),
      url: url.trim(),
      notes: notes?.trim() || null,
      opens_at: opens_at || null,
    })
    .select()
    .single(), 'createWatchlistProgram')
}

/**
 * Remove a program. Returns the rows actually deleted.
 *
 * Returns rows rather than nothing because `programs` had no DELETE policy: 0044
 * dropped the ALL-policy for SELECT-only and 0077 restored INSERT and UPDATE but
 * not DELETE. An RLS-blocked delete is not an error — zero rows, success — so a
 * caller that assumes cannot tell it apart from a real delete, which is why the
 * row kept reappearing on reload. Migration 0082 adds the policy; the caller
 * still checks the returned length, because that is the honest contract and it
 * costs nothing.
 */
export async function deleteProgram(supabase, id) {
  return unwrapList(await supabase
    .from('programs')
    .delete()
    .eq('id', id)
    .select(), 'deleteProgram')
}

export async function setProgramWindowOpen(supabase, id, windowOpen) {
  const result = await supabase.from('programs').update({ window_open: windowOpen }).eq('id', id)
  return unwrap(result, 'setProgramWindowOpen')
}

// An empty string from a cleared `<input type="date">` means "no deadline", not
// a date of ''. Normalising here rather than at the call site keeps the one
// column that has a not-a-value state from being re-derived per caller.
export async function setProgramDeadline(supabase, id, deadline) {
  const result = await supabase.from('programs').update({ deadline: deadline || null }).eq('id', id)
  return unwrap(result, 'setProgramDeadline')
}

// `window_open: false` is set explicitly rather than left to a column default: a
// program you just added has not been checked yet, and "unknown" reading as
// "open" would put it on the deadline radar on no evidence.
export async function createProgram(supabase, { name, url, category, deadline, notes }) {
  const result = await supabase
    .from('programs')
    .insert({
      name: name.trim(),
      url: url.trim(),
      category,
      deadline: deadline || null,
      // `notes` was in the form state and the insert but had no input for a
      // while, so it was written as null every time. Trimmed to null rather
      // than stored as '' so "no notes" is one value, not two.
      notes: notes?.trim() || null,
      window_open: false,
    })
    .select()
    .single()
  return unwrap(result, 'createProgram')
}
