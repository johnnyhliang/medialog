// Per-user capture tokens for the bookmarklet, iOS Shortcut, and (later) the
// browser extension.
//
// Replaces VITE_CAPTURE_SECRET, which was inlined into the client bundle at build
// time and shared by every user. See migration 0063.
//
// The token is generated in the browser and only its SHA-256 hash is stored, so
// the plaintext exists exactly once — in the response of createCaptureToken — and
// is unrecoverable afterwards. Same contract as a GitHub PAT: copy it now or make
// a new one.

// 32 bytes of CSPRNG entropy, base64url so it survives being pasted into a
// bookmarklet, a JSON body, and a Shortcuts text field without escaping.
function generateToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function listCaptureTokens(supabase) {
  const { data, error } = await supabase
    .from('capture_tokens')
    .select('id, label, created_at, last_used_at, revoked_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Mints a token. The returned `token` is the ONLY time the plaintext exists —
 * callers must surface it immediately and must not persist it anywhere.
 */
export async function createCaptureToken(supabase, label = null) {
  const token = generateToken()
  const token_hash = await hashToken(token)
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('capture_tokens')
    .insert({ user_id: user.id, token_hash, label })
    .select('id, label, created_at')
    .single()
  if (error) throw new Error(error.message)
  return { ...data, token }
}

// Revoke rather than delete: last_used_at on a revoked row is evidence of when a
// leaked token stopped working, which a deleted row destroys.
export async function revokeCaptureToken(supabase, id) {
  const { error } = await supabase
    .from('capture_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
