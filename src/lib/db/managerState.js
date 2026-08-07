// Every query the Manager makes. New file rather than an extension of
// digest.js: digest.js owns one function that answers "what happened lately"
// across entries, and its seven-way Promise.all is already the thing that makes
// it expensive to touch. The Manager asks a different question ("where does each
// topic stand"), so bolting it on would have meant either widening computeDigest
// for a caller that wants none of its six other results, or a second exported
// function in a file named for the digest. Separate file, one concern each.
//
// Conventions follow src/lib/db/entries.js: `supabase` first, throw on error,
// filter soft-deleted rows out.

const EMPTY = { states: [], entries: [] }

/** The one piece of state the Manager stores rather than derives. */
export async function listTopicStates(supabase) {
  const { data, error } = await supabase
    .from('topic_state')
    .select('topic_id, next_action, parked_at, parked_note, updated_at')
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * The per-topic activity the cards are derived from: counts by status and the
 * newest touch. Deliberately the narrowest possible projection — three columns,
 * no joins, no note bodies — because this is the row-count-heavy half.
 */
export async function listTopicActivity(supabase) {
  const { data, error } = await supabase
    .from('entries')
    .select('topic_id, status, updated_at')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Everything the Manager view needs, in one wave. Called from loadManager() on
 * navigation, never at app mount.
 */
export async function loadManagerData(supabase) {
  if (!supabase) return EMPTY
  const [states, entries] = await Promise.all([
    listTopicStates(supabase),
    listTopicActivity(supabase),
  ])
  return { states, entries }
}

async function upsertState(supabase, topicId, patch) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('topic_state')
    .upsert(
      { topic_id: topicId, user_id: user.id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'topic_id' },
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/** The one human-written field. Blank clears it rather than storing ''. */
export async function setNextAction(supabase, topicId, text) {
  const value = String(text ?? '').trim()
  return upsertState(supabase, topicId, { next_action: value || null })
}

/** Park with a note-to-future-self. Parked is not archived — see §3. */
export async function parkTopic(supabase, topicId, note) {
  return upsertState(supabase, topicId, {
    parked_at: new Date().toISOString(),
    parked_note: String(note ?? '').trim() || null,
  })
}

/**
 * Unpark. The note is cleared with the park: it was a note about *why this is
 * shelved*, and leaving it behind on a live topic would read as a stale next
 * action. `next_action` is untouched.
 */
export async function unparkTopic(supabase, topicId) {
  return upsertState(supabase, topicId, { parked_at: null, parked_note: null })
}
