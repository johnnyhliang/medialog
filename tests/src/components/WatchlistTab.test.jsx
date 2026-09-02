import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import WatchlistTab from '../../../src/components/WatchlistTab.jsx'

function makeSupabase(programs = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: programs, error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: 'new-1', name: 'New Program', url: 'https://example.com', notes: '', opens_at: null, window_open: false },
      error: null,
    }),
    delete: vi.fn().mockReturnThis(),
  }
  return {
    from: vi.fn(() => chain),
    _chain: chain,
  }
}

// Dated relative to now. This was hardcoded to '2026-09-01', which stopped
// being a future date on 2026-09-01 — from then on StatusBadge rendered
// "closed" rather than "Opens Sep 2026" and the assertion below failed for
// reasons that had nothing to do with the component.
const OPENS_AT = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
const OPENS_LABEL = new Date(OPENS_AT + 'T00:00:00')
  .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

const samplePrograms = [
  { id: '1', name: 'Google STEP', url: 'https://step.google', notes: 'good program', opens_at: OPENS_AT, window_open: false },
  { id: '2', name: 'MLH Fellowship', url: 'https://mlh.io', notes: '', opens_at: null, window_open: true },
]

test('renders program list', async () => {
  const sb = makeSupabase(samplePrograms)
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => expect(screen.getByText('Google STEP')).toBeInTheDocument())
  expect(screen.getByText('MLH Fellowship')).toBeInTheDocument()
})

test('search filters by name and notes', async () => {
  const sb = makeSupabase(samplePrograms)
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => screen.getByText('Google STEP'))
  await userEvent.type(screen.getByPlaceholderText(/search/i), 'good')
  expect(screen.getByText('Google STEP')).toBeInTheDocument()
  expect(screen.queryByText('MLH Fellowship')).not.toBeInTheDocument()
})

test('shows open badge for window_open programs', async () => {
  const sb = makeSupabase(samplePrograms)
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => screen.getByText('MLH Fellowship'))
  expect(screen.getByText('open')).toBeInTheDocument()
})

test('shows opens_at date when present', async () => {
  const sb = makeSupabase(samplePrograms)
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => screen.getByText('Google STEP'))
  expect(screen.getByText(new RegExp(OPENS_LABEL, 'i'))).toBeInTheDocument()
})

test('add form inserts new program', async () => {
  const sb = makeSupabase([])
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => expect(sb.from).toHaveBeenCalled())
  await userEvent.click(screen.getByRole('button', { name: /add/i }))
  await userEvent.type(screen.getByPlaceholderText(/program name/i), 'New Program')
  await userEvent.type(screen.getByPlaceholderText(/url/i), 'https://example.com')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(sb._chain.insert).toHaveBeenCalled()
})
