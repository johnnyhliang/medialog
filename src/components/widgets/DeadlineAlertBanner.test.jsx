import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import DeadlineAlertBanner from './DeadlineAlertBanner.jsx'

function mockSupabase(programs) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: programs, error: null }),
      }),
    }),
  }
}

beforeEach(() => localStorage.clear())

test('renders nothing when no open programs', async () => {
  const { container } = render(<DeadlineAlertBanner supabase={mockSupabase([])} />)
  await waitFor(() => {})
  expect(container.firstChild).toBeNull()
})

test('renders open program with deadline', async () => {
  const programs = [{ id: '1', name: 'Neo Scholars', url: 'https://neo.com', deadline: '2026-09-15', category: 'program', company: 'Neo', notes: null, window_open: true }]
  render(<DeadlineAlertBanner supabase={mockSupabase(programs)} />)
  expect(await screen.findByText(/Neo Scholars/)).toBeInTheDocument()
  expect(screen.getByText(/Sep 15/)).toBeInTheDocument()
})

test('dismiss hides the row', async () => {
  const programs = [{ id: '2', name: '8VC Fellowship', url: 'https://8vc.com', deadline: null, category: 'fellowship', company: '8VC', notes: null, window_open: true }]
  render(<DeadlineAlertBanner supabase={mockSupabase(programs)} />)
  await screen.findByText(/8VC Fellowship/)
  await userEvent.click(screen.getByRole('button', { name: '×' }))
  expect(screen.queryByText(/8VC Fellowship/)).not.toBeInTheDocument()
})
