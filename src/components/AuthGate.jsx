import { useSession } from '../hooks/useSession.js'
import SetPasswordModal from './SetPasswordModal.jsx'

export default function AuthGate({ children }) {
  const { session, loading, isRecovery } = useSession()

  if (loading) return null

  if (session && isRecovery) {
    return (
      <>
        {children}
        <SetPasswordModal onDone={() => window.location.reload()} />
      </>
    )
  }

  if (session) return children

  // Not logged in — landing page handles auth
  window.location.replace('/')
  return null
}
