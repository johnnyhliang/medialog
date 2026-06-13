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

  return (
    <form className="auth" onSubmit={handleSubmit}>
      <h1>MediaLog</h1>
      {sent ? (
        <p className="muted">Check your email for a login link.</p>
      ) : (
        <>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Send magic link</button>
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        </>
      )}
    </form>
  )
}
