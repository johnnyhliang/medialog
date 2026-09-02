// Everything the Files view asks the backend for: the `attachments` storage
// bucket, plus the one `entries` query that answers "what is still using this
// file?".
//
// Storage lives here rather than in a separate module because the bucket and
// that entries query are one feature — you cannot safely offer "delete" without
// the reference list, and splitting them across two modules is how the two
// drifted apart in the first place (the bucket path was built inline in three
// places, each re-deriving `${userId}/${name}`).

import { unwrap, unwrapList } from './unwrap.js'

const BUCKET = 'attachments'

// One hour. Long enough that a browse session never re-signs mid-scroll, short
// enough that a copied URL is not a permanent public link to a private file.
const SIGNED_URL_TTL = 60 * 60

// The bucket is partitioned by user id, and every caller used to spell this
// join out itself. A single typo there is not a visible error — it is an empty
// folder, which looks exactly like "you have no files".
const filePath = (userId, fileName) => `${userId}/${fileName}`

/** Every uploaded file for one user, as storage FileObjects. */
export async function listAttachments(supabase, userId) {
  const result = await supabase.storage.from(BUCKET).list(userId)
  return unwrapList(result, 'listAttachments')
}

/**
 * A short-lived signed URL for one uploaded file.
 *
 * Returns null only when storage genuinely has no URL to give; a FAILURE
 * throws. The old inline version destructured `data` alone, so an expired
 * session and a missing file both came back as null and rendered as a silently
 * broken thumbnail.
 */
export async function signAttachmentUrl(supabase, userId, fileName) {
  const result = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath(userId, fileName), SIGNED_URL_TTL)
  return unwrap(result, 'signAttachmentUrl')?.signedUrl ?? null
}

export async function deleteAttachment(supabase, userId, fileName) {
  const result = await supabase.storage.from(BUCKET).remove([filePath(userId, fileName)])
  unwrap(result, 'deleteAttachment')
}

/**
 * The entries whose note text embeds `url` — the "Used in:" line, and the list
 * the delete confirmation warns with.
 *
 * `deleted_at is null` matters more here than in most list queries: without it
 * a file looks referenced by entries the user already threw away, so the
 * confirmation talks them out of a delete that would break nothing.
 */
export async function listEntriesReferencingFile(supabase, url) {
  const result = await supabase
    .from('entries')
    .select('id, title, topic_id')
    .like('note', `%${url}%`)
    .is('deleted_at', null)
  return unwrapList(result, 'listEntriesReferencingFile')
}
