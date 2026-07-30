import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'

vi.mock('../../src/hooks/useSession.js', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

vi.mock('../../src/lib/supabaseClient.js', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    // Files is an opt-in module now, so a bare account wouldn't render the nav
    // item at all. Present as a grandfathered account (everything on) — see
    // src/lib/modules.js — which is what any pre-modules account looks like.
    maybeSingle: vi.fn().mockResolvedValue({ data: { tier: 'founder', modules: { __grandfathered: true } } }),
    then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
  }
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signOut: vi.fn(),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      },
      from: vi.fn().mockReturnValue(chainable),
      storage: {
        from: vi.fn().mockReturnValue({
          list: vi.fn().mockResolvedValue({ data: [] }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
        })
      },
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    }
  }
})

vi.mock('../../src/components/FilesView.jsx', () => ({
  default: () => <div data-testid="files-view">FilesView</div>
}))

import App from '../../src/App.jsx'

test('Files nav item renders and switches to files view', async () => {
  render(<App />)
  await screen.findByText('Files')
  await userEvent.click(screen.getByText('Files'))
  expect(await screen.findByTestId('files-view')).toBeInTheDocument()
})
