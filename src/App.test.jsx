import { render } from '@testing-library/react'
import { vi, test, expect } from 'vitest'

vi.mock('./hooks/useSession.js', () => ({
  useSession: () => ({ session: null, loading: false, isRecovery: false }),
}))
vi.mock('./lib/supabaseClient.js', () => ({
  supabase: { auth: { signInWithOtp: vi.fn() } },
}))
vi.mock('./lib/enrich.js', () => ({ fetchTitle: vi.fn(() => Promise.resolve(null)) }))

import App from './App.jsx'

test('renders nothing and redirects when logged out', () => {
  const replaceSpy = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, replace: replaceSpy },
    writable: true,
  })
  const { container } = render(<App />)
  expect(replaceSpy).toHaveBeenCalledWith('/')
  expect(container).toBeEmptyDOMElement()
})
