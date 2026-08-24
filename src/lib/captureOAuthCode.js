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
// WHY `state` AND NOT THE PATHNAME (changed 2026-08-24)
//
// Every defence in this flow used to key off `pathname.includes('/settings')`:
// this capture, supabaseClient's detectSessionInUrl switch, and App.jsx's
// fallback read. Three fixes that looked independent shared ONE point of
// failure — if the browser landed anywhere else, all three failed at once and
// in silence: detection turned back on and ate the code, the capture never
// fired, and the fallback returned null. That is the shape of "three correct
// fixes changed nothing".
//
// We do not fully control the landing path. GitHub redirects to the callback
// URL registered on the app, which need not be the redirect_uri we send. So the
// signal has to travel WITH the request instead of being inferred from where it
// lands. `state` does exactly that, and round-tripping it is also what OAuth
// requires for CSRF protection — which this flow previously had none of.
const KEY = 'medialog_github_oauth_code'
const STATE_KEY = 'medialog_github_oauth_state'

/**
 * Start a GitHub OAuth handshake: mint a state token, remember it, hand it to
 * the caller to put in the authorize URL. Reading it back on return is what
 * proves the code is ours and not another provider's.
 */
export function beginGitHubOAuth() {
  const state = `medialog_${
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`
  }`
  try {
    sessionStorage.setItem(STATE_KEY, state)
  } catch { /* no storage — the pathname fallback below still covers the common case */ }
  return state
}

function capture() {
  try {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return false

    const returned = params.get('state')
    let expected = null
    try { expected = sessionStorage.getItem(STATE_KEY) } catch { /* ignore */ }

    // Ours if the state we minted comes back. Path-independent by design.
    const stateMatches = Boolean(returned && expected && returned === expected)

    // Fallback for a handshake started before this code shipped (its authorize
    // URL carried no state), and for the storage-blocked case above. Narrow on
    // purpose: Supabase's own auth returns to /app with a code that IS its own,
    // and stealing that would break sign-in.
    const legacyPathMatch = !returned && window.location.pathname.includes('/settings')

    if (!stateMatches && !legacyPathMatch) return false

    sessionStorage.setItem(KEY, code)
    try { sessionStorage.removeItem(STATE_KEY) } catch { /* ignore */ }
    // Take code AND state out of the URL so supabase-js cannot mistake the code
    // for a PKCE code, and so a reload cannot replay a consumed handshake.
    window.history.replaceState({}, document.title, window.location.pathname)
    return true
  } catch {
    // No storage (private mode, SSR). Fall back to the URL read in App.jsx.
    return false
  }
}

/**
 * True when this page load is GitHub's backup callback.
 *
 * Exported so supabaseClient.js can IMPORT it rather than recomputing the same
 * condition. That import is the point: it makes this module a dependency of
 * supabaseClient, so ESM guarantees the capture above runs before createClient.
 * The previous version relied on the order of side-effect imports in main.jsx,
 * which Rollup does not preserve — it inlined this module into the app chunk
 * while leaving supabaseClient a separate static import, and a statically
 * imported module is fully evaluated BEFORE the importing module's body. The
 * guarantee the comment in main.jsx described did not survive the build.
 */
export const isGitHubBackupCallback = typeof window !== 'undefined' && capture()

/** Consume the stashed code. Single-use: reading it clears it. */
export function takeGitHubOAuthCode() {
  try {
    const code = sessionStorage.getItem(KEY)
    if (code) sessionStorage.removeItem(KEY)
    return code
  } catch { return null }
}
