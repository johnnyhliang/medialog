import { render, screen } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import AuthGate from './AuthGate.jsx'

vi.mock('../hooks/useSession.js', () => ({ useSession: vi.fn() }))
import { useSession } from '../hooks/useSession.js'

beforeEach(() => vi.clearAllMocks())

test('redirects to landing and renders nothing when logged out', () => {
  const replaceSpy = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, replace: replaceSpy },
    writable: true,
  })
  useSession.mockReturnValue({ session: null, loading: false, isRecovery: false })
  const { container } = render(<AuthGate><div>secret</div></AuthGate>)
  expect(replaceSpy).toHaveBeenCalledWith('/')
  expect(container).toBeEmptyDOMElement()
})

test('renders children when logged in', () => {
  useSession.mockReturnValue({ session: { user: { id: '1' } }, loading: false, isRecovery: false })
  render(<AuthGate><div>secret</div></AuthGate>)
  expect(screen.getByText('secret')).toBeInTheDocument()
})
