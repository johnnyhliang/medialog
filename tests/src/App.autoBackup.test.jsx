import { render, act } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'

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
    update: vi.fn().mockReturnThis(),
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
        }),
      },
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    },
  }
})

import { supabase } from '../../src/lib/supabaseClient.js'
import App from '../../src/App.jsx'

beforeEach(() => { vi.clearAllMocks() })

// The auto-backup effect schedules a 60 s timer and returned no cleanup, so the
// timer survived unmount: it woke on a dead tree, queried user_configs with a
// possibly signed-out client and pushed a toast into nothing.
test('the auto-backup timer does not fire after unmount', async () => {
  vi.useFakeTimers()
  try {
    const { unmount } = await act(async () => render(<App />))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    unmount()
    supabase.from.mockClear()
    await act(async () => { await vi.advanceTimersByTimeAsync(120000) })
    const tables = supabase.from.mock.calls.map((c) => c[0])
    expect(tables).not.toContain('user_configs')
  } finally {
    vi.useRealTimers()
  }
})
