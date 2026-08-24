import { describe, test, expect, beforeEach, vi } from 'vitest'

// The module captures on import, so each case needs a fresh module registry
// with window/sessionStorage already staged.
async function loadWith(pathname, search) {
  vi.resetModules()
  sessionStorage.clear()
  window.history.replaceState({}, '', pathname + search)
  return await import('../../../src/lib/captureOAuthCode.js')
}

describe('captureOAuthCode', () => {
  beforeEach(() => sessionStorage.clear())

  test('stashes the code on the GitHub callback path and clears the url', async () => {
    // Why it exists: supabase-js is constructed at import time and treats any
    // ?code= as its own, and AuthGate can redirect before React reads the URL.
    const m = await loadWith('/settings', '?code=gho_abc')
    expect(window.location.search).toBe('')
    expect(m.takeGitHubOAuthCode()).toBe('gho_abc')
  })

  test('ignores a code on other paths, so supabase sign-in still works', async () => {
    const m = await loadWith('/app', '?code=supabase_pkce')
    expect(window.location.search).toBe('?code=supabase_pkce')
    expect(m.takeGitHubOAuthCode()).toBeNull()
  })

  test('is single-use — an auth code cannot be replayed', async () => {
    const m = await loadWith('/settings', '?code=gho_abc')
    expect(m.takeGitHubOAuthCode()).toBe('gho_abc')
    expect(m.takeGitHubOAuthCode()).toBeNull()
  })

  test('no code in the url stashes nothing', async () => {
    const m = await loadWith('/settings', '')
    expect(m.takeGitHubOAuthCode()).toBeNull()
  })
})

describe('state-keyed capture — path independence', () => {
  beforeEach(() => sessionStorage.clear())

  // The regression this pins: every defence used to key on
  // pathname.includes('/settings'), so a callback landing anywhere else failed
  // in three places at once and in total silence. GitHub redirects to the
  // callback URL registered on the app, which need not be the redirect_uri we
  // send — so the landing path is not ours to assume.
  test('captures on ANY path when the state we minted comes back', async () => {
    vi.resetModules()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/settings')
    const { beginGitHubOAuth } = await import('../../../src/lib/captureOAuthCode.js')
    const state = beginGitHubOAuth()

    vi.resetModules()
    window.history.replaceState({}, '', `/app?code=gho_xyz&state=${state}`)
    const m = await import('../../../src/lib/captureOAuthCode.js')

    expect(m.isGitHubBackupCallback).toBe(true)
    expect(m.takeGitHubOAuthCode()).toBe('gho_xyz')
    expect(window.location.search).toBe('')
  })

  test('a foreign state is NOT ours — supabase sign-in on /app is untouched', async () => {
    vi.resetModules()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/settings')
    const { beginGitHubOAuth } = await import('../../../src/lib/captureOAuthCode.js')
    beginGitHubOAuth()

    vi.resetModules()
    window.history.replaceState({}, '', '/app?code=supabase_pkce&state=someone_elses')
    const m = await import('../../../src/lib/captureOAuthCode.js')

    expect(m.isGitHubBackupCallback).toBe(false)
    expect(m.takeGitHubOAuthCode()).toBeNull()
    expect(window.location.search).toBe('?code=supabase_pkce&state=someone_elses')
  })

  test('state is single-use — a replayed callback is not accepted twice', async () => {
    vi.resetModules()
    sessionStorage.clear()
    window.history.replaceState({}, '', '/settings')
    const { beginGitHubOAuth } = await import('../../../src/lib/captureOAuthCode.js')
    const state = beginGitHubOAuth()

    vi.resetModules()
    window.history.replaceState({}, '', `/settings?code=gho_1&state=${state}`)
    const first = await import('../../../src/lib/captureOAuthCode.js')
    expect(first.takeGitHubOAuthCode()).toBe('gho_1')

    // Same state replayed: the minted value was consumed, so this is refused.
    vi.resetModules()
    window.history.replaceState({}, '', `/settings?code=gho_2&state=${state}`)
    const second = await import('../../../src/lib/captureOAuthCode.js')
    expect(second.isGitHubBackupCallback).toBe(false)
    expect(second.takeGitHubOAuthCode()).toBeNull()
  })

  test('legacy path fallback still works for a handshake started before this shipped', async () => {
    // That authorize URL carried no state at all, so the old pathname rule has
    // to keep working or an in-flight connect breaks on deploy.
    const m = await loadWith('/settings', '?code=gho_legacy')
    expect(m.isGitHubBackupCallback).toBe(true)
    expect(m.takeGitHubOAuthCode()).toBe('gho_legacy')
  })

  test('beginGitHubOAuth mints a distinct state each time', async () => {
    vi.resetModules()
    const { beginGitHubOAuth } = await import('../../../src/lib/captureOAuthCode.js')
    expect(beginGitHubOAuth()).not.toBe(beginGitHubOAuth())
  })
})
