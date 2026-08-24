import { createClient } from '@supabase/supabase-js'
import { isGitHubBackupCallback } from './captureOAuthCode.js'

// Two different OAuth flows land back in this app, and BOTH return `?code=`:
//
//   Supabase auth (sign-in, magic link) -> /app
//   GitHub backup connect               -> /settings
//
// supabase-js defaults to detectSessionInUrl:true with the PKCE flow, and this
// module is constructed at import time — before React renders. So on /settings
// it would see GitHub's code, assume it was its own, fail the exchange, and
// strip the query. App.jsx's handler then found no code and did nothing at all:
// no error, no toast, just a silent return to Home that looked like the connect
// had failed.
//
// Scoped rather than switched off, because turning detection off entirely
// would break sign-in, which genuinely needs it.
//
// Imported, not recomputed. The import is load-bearing twice over: it keys the
// switch on the OAuth `state` we minted rather than on the landing path (which
// GitHub, not us, decides), and it makes captureOAuthCode a DEPENDENCY of this
// module, so ESM guarantees the code is lifted out of the URL before
// createClient runs. The previous version relied on side-effect import order in
// main.jsx, which the bundler does not preserve.

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { detectSessionInUrl: !isGitHubBackupCallback } },
)
