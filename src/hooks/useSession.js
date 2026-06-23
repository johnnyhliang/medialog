import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

// Returns { session, loading, isRecovery }.
// isRecovery = true when the user arrived via a password-reset link — show a
// "set your password" screen instead of the normal app.
export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    // Rely solely on onAuthStateChange (fires INITIAL_SESSION on load).
    // This avoids a race where getSession() resolves before magic-link token
    // exchange completes, causing AuthGate to redirect to / prematurely.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
        setSession(s)
        setLoading(false)
      } else {
        setIsRecovery(false)
        setSession(s)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, loading, isRecovery }
}
