import { useSession } from '../hooks/useSession.js'

export default function AuthGate({ children }) {
  const { session, loading } = useSession()

  if (loading) return null
  if (session) return children

  // Not logged in — landing page handles auth
  window.location.replace('/')
  return null
}
