import { useState } from 'react'
import { useSession } from '../hooks/useSession.js'
import { supabase } from '../lib/supabaseClient.js'

export default function AuthGate({ children }) {
  const { session, loading } = useSession()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  if (loading) return <p>Loading…</p>
  if (session) return children

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  async function handleGitHubLogin() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="auth">
      <h1>MediaLog</h1>
      <form onSubmit={handleSubmit}>
        {sent ? (
          <p className="muted">Check your email for a login link.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px' }}>
            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit">Send magic link</button>
            <div className="divider"><span>OR</span></div>
            <button type="button" className="github-btn" onClick={handleGitHubLogin}>
              Sign in with GitHub
            </button>
            {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          </div>
        )}
      </form>
      <style dangerouslySetInnerHTML={{ __html: `
        .auth { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; }
        .auth form { width: 100%; display: flex; flex-direction: column; align-items: center; }
        .divider { margin: 0.5rem 0; width: 100%; text-align: center; border-bottom: 1px solid var(--border); line-height: 0.1em; }
        .divider span { background: var(--bg); padding: 0 10px; color: var(--muted); font-size: 0.8rem; }
        .github-btn { background: #24292e; color: white; border: none; width: 100%; }
        .github-btn:hover { background: #444d56; }
      `}} />
    </div>
  )
}
