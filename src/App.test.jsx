import { render, screen } from '@testing-library/react'
import { vi, test, expect } from 'vitest'

vi.mock('./hooks/useSession.js', () => ({
  useSession: () => ({ session: null, loading: false }),
}))
vi.mock('./lib/supabaseClient.js', () => ({
  supabase: { auth: { signInWithOtp: vi.fn() } },
}))

import App from './App.jsx'

test('renders login when logged out', () => {
  render(<App />)
  expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
})
