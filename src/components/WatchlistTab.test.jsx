import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import WatchlistTab from './WatchlistTab.jsx'

function makeSupabase(programs = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: programs, error: null }),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
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

const samplePrograms = [
  { id: '1', name: 'Google STEP', url: 'https://step.google', notes: 'good program', opens_at: '2026-09-01', window_open: false },
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
  expect(screen.getByText(/Sep 2026/i)).toBeInTheDocument()
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
