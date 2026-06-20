import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import OpportunitiesWidget from './OpportunitiesWidget.jsx'

function makeItem(overrides = {}) {
  return {
    id: 'a',
    source: 'hn',
    company: 'Stripe',
    title: 'SWE Intern',
    body: null,
    url: 'https://hn.com/1',
    author: null,
    posted_at: new Date(Date.now() - 3600000).toISOString(),
    tags: ['hn'],
    is_read: false,
    is_saved: false,
    ...overrides,
  }
}

function mockSupabase(items = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: makeItem({ id: 'new', source: 'manual', title: 'example.com' }), error: null }) })
  }))
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: items, error: null })),
        })),
      })),
      update: updateFn,
      insert: insertFn,
    })),
    _updateFn: updateFn,
    _insertFn: insertFn,
  }
}

test('shows unread badge count', async () => {
  const items = [makeItem({ id: '1' }), makeItem({ id: '2' })]
  render(<OpportunitiesWidget supabase={mockSupabase(items)} onTrack={vi.fn()} />)
  expect(await screen.findByText(/2 new/)).toBeInTheDocument()
})

test('clicking title marks as read', async () => {
  const sb = mockSupabase([makeItem()])
  render(<OpportunitiesWidget supabase={sb} onTrack={vi.fn()} />)
  await screen.findByText(/Stripe — SWE Intern/)
  await userEvent.click(screen.getByRole('link', { name: /Stripe — SWE Intern/ }))
  expect(sb._updateFn).toHaveBeenCalled()
})

test('manual add form submits url', async () => {
  const sb = mockSupabase([])
  render(<OpportunitiesWidget supabase={sb} onTrack={vi.fn()} />)
  await waitFor(() => {})
  await userEvent.click(screen.getByText('+ add'))
  await userEvent.type(screen.getByPlaceholderText('URL'), 'https://example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(sb._insertFn).toHaveBeenCalled()
})

test('filter pill filters by quant tag', async () => {
  const items = [
    makeItem({ id: '1', company: 'Stripe', tags: ['startup'] }),
    makeItem({ id: '2', company: 'Jane Street', tags: ['quant'] }),
  ]
  render(<OpportunitiesWidget supabase={mockSupabase(items)} onTrack={vi.fn()} />)
  await screen.findByText(/Stripe/)
  await userEvent.click(screen.getByRole('button', { name: 'Quant' }))
  expect(screen.queryByText(/Stripe/)).not.toBeInTheDocument()
  expect(screen.getByText(/Jane Street/)).toBeInTheDocument()
})
