import { render, screen } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import AuthGate from './AuthGate.jsx'

vi.mock('../hooks/useSession.js', () => ({ useSession: vi.fn() }))
vi.mock('../lib/supabaseClient.js', () => ({
  supabase: { auth: { signInWithOtp: vi.fn(() => Promise.resolve({ error: null })) } },
}))
import { useSession } from '../hooks/useSession.js'

beforeEach(() => vi.clearAllMocks())

test('shows login form when logged out', () => {
  useSession.mockReturnValue({ session: null, loading: false })
  render(<AuthGate><div>secret</div></AuthGate>)
  expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
  expect(screen.queryByText('secret')).not.toBeInTheDocument()
})

test('renders children when logged in', () => {
  useSession.mockReturnValue({ session: { user: { id: '1' } }, loading: false })
  render(<AuthGate><div>secret</div></AuthGate>)
  expect(screen.getByText('secret')).toBeInTheDocument()
})
