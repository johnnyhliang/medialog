// One way to answer "who is signed in", for the ~30 sites that each answered it
// slightly differently.
//
// The pattern being replaced is `const { data: { user } } = await
// supabase.auth.getUser()` — an inline destructure that drops `error` AND
// assumes `data.user` exists. It has two distinct failure modes and neither is
// visible:
//
//   1. The call errors (expired refresh token, network). `data` is null, so the
//      destructure itself throws a TypeError reading 'user' of null — an error
//      about the shape of an object, thrown from a line that has nothing to do
//      with auth, which is about as far from the real cause as a stack can get.
//   2. The call succeeds with no session. `user` is undefined, and the code
//      carries on to build a query filtered by `user_id: undefined` — which
//      does not error. It returns nothing, and looks exactly like an account
//      with no data.
//
// The second is the dangerous one, and it is the same lie as `data ?? []`:
// a broken state rendering as an empty one.

/**
 * Resolve the signed-in user, or throw.
 *
 * @returns {Promise<object>} the user — never null, never undefined
 */
export async function requireUser(supabase) {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data?.user) throw new NotSignedInError()
  return data.user
}

/**
 * Distinct from a generic Error so callers can tell "you are logged out" apart
 * from "the database failed", and react differently. They are the same shape to
 * a `catch` block but not the same event: one warrants a sign-in prompt, the
 * other a retry or an error toast. Flattening both into `throw new
 * Error('Not signed in')` is what forces callers to string-match the message.
 */
export class NotSignedInError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'NotSignedInError'
  }
}

/**
 * For paths where being signed out is an ordinary, expected outcome rather than
 * a failure — a background timer, an optional widget, anything that runs before
 * the session settles. Returns null instead of throwing, but STILL surfaces a
 * genuine auth error, which is the distinction the old inline destructure could
 * not express at all.
 */
export async function getUserOrNull(supabase) {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data?.user ?? null
}
