// Reader highlights: a quote pulled out of an entry's full_text, optionally
// with a note attached.
//
// Two views read this table and they want opposite things, which is why there
// are two list functions rather than one with a flag: the reader wants one
// article's highlights in reading order, the Highlights view wants the whole
// library newest-first with its source entry joined on.

import { unwrap, unwrapList } from './unwrap.js'
import { requireUser } from '../requireUser.js'

/**
 * One entry's highlights, oldest first.
 *
 * Ascending is deliberate and not a stale copy of the other query: the reader
 * replays these over the article text, so creation order is the closest thing
 * to document order it has.
 */
export async function listHighlightsForEntry(supabase, entryId) {
  const result = await supabase
    .from('highlights')
    .select('*')
    .eq('entry_id', entryId)
    .order('created_at')
  return unwrapList(result, 'listHighlightsForEntry')
}

/**
 * Every highlight, newest first, with its source entry.
 *
 * DRIFT FIXED: this join had no `deleted_at is null`, unlike every other
 * entries read in the app. Highlights of trashed entries kept showing in the
 * list, and clicking one opened the reader on an entry the user had already
 * deleted — the trash was not actually hiding anything here. `!inner` is
 * required for the filter to work: with the default left join, PostgREST
 * applies `entries.deleted_at is null` by nulling the embedded object instead
 * of dropping the row, which would leave the highlight visible with "Unknown
 * article" as its source. Rows whose entry is gone entirely disappear too,
 * which is the same answer.
 */
export async function listAllHighlights(supabase) {
  const result = await supabase
    .from('highlights')
    .select('*, entries!inner(id, title, url, full_text)')
    .is('entries.deleted_at', null)
    .order('created_at', { ascending: false })
  return unwrapList(result, 'listAllHighlights')
}

/**
 * Save a highlight. Returns the inserted row.
 *
 * `requireUser`, not `getUserOrNull`: this only ever runs from a click on
 * "Highlight", so there is no session-still-settling case to tolerate, and
 * being signed out is a failure of an action the user explicitly asked for.
 * The previous inline `if (!user) return` made that failure invisible — the
 * picker closed, the selection cleared, and nothing was saved.
 */
export async function createHighlight(supabase, { entryId, text, color, note }) {
  const user = await requireUser(supabase)
  const result = await supabase
    .from('highlights')
    .insert({
      user_id: user.id,
      entry_id: entryId,
      text,
      color,
      note: note?.trim() || null,
    })
    .select()
    .single()
  return unwrap(result, 'createHighlight')
}

export async function deleteHighlight(supabase, id) {
  const result = await supabase.from('highlights').delete().eq('id', id)
  unwrap(result, 'deleteHighlight')
}
