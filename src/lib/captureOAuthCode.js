// Grabs the GitHub OAuth code out of the URL the instant this module is
// evaluated, before anything else can consume or discard it.
//
// The code used to be read from window.location inside a React effect, which
// lost every race that matters:
//
//   - supabase-js is constructed at import time and, with detectSessionInUrl,
//     treats any `?code=` as its own PKCE code and strips the query.
//   - AuthGate redirects to `/` whenever the session is momentarily falsy
//     (useSession waits for INITIAL_SESSION), and LandingPage then sends an
//     authenticated user to `/app`. Both are location.replace, so the query is
//     destroyed — which is why the code appeared for an instant and the app
//     landed on /app having done nothing.
//
// Stashing it in sessionStorage decouples "we received a code" from "the app is
// ready to use it", so no redirect in between can lose it. sessionStorage
// because it must not outlive the tab: an auth code is single-use, and a stale
// one would produce bad_verification_code on the next launch.
//
// MUST be imported before ./supabaseClient.js. Side-effect imports evaluate in
// source order, so the position of the import in main.jsx is load-bearing.
const KEY = 'medialog_github_oauth_code'

try {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  // Only on the GitHub backup callback path. Supabase's own auth returns to
  // /app with a code that is genuinely its own, and stealing that would break
  // sign-in.
  if (code && window.location.pathname.includes('/settings')) {
    sessionStorage.setItem(KEY, code)
    // Take it out of the URL so supabase-js cannot mistake it for a PKCE code.
    window.history.replaceState({}, document.title, window.location.pathname)
  }
} catch { /* no storage (private mode, SSR) — fall back to the URL read */ }

/** Consume the stashed code. Single-use: reading it clears it. */
export function takeGitHubOAuthCode() {
  try {
    const code = sessionStorage.getItem(KEY)
    if (code) sessionStorage.removeItem(KEY)
    return code
  } catch { return null }
}
