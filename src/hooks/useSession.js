import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

// Returns { session, loading }. session is null when logged out.
export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Rely solely on onAuthStateChange (fires INITIAL_SESSION on load).
    // This avoids a race where getSession() resolves before magic-link token
    // exchange completes, causing AuthGate to redirect to / prematurely.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, loading }
}
