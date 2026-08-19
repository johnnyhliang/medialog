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
