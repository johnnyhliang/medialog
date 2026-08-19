import { createClient } from '@supabase/supabase-js'

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
// Scoped by path rather than switched off, because turning detection off
// entirely would break sign-in, which genuinely needs it.
const isGitHubBackupCallback =
  typeof window !== 'undefined' && window.location.pathname.includes('/settings')

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { detectSessionInUrl: !isGitHubBackupCallback } },
)
