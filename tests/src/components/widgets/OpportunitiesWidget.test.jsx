import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import OpportunitiesWidget from '../../../../src/components/widgets/OpportunitiesWidget.jsx'

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

// The mock is table-aware because the widget now reads and writes two tables:
// the shared `opportunities` board and the per-user `opportunity_state` side
// table it used to (wrongly) skip.
function mockSupabase(items = [], state = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const upsertFn = vi.fn(() => Promise.resolve({ error: null }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: makeItem({ id: 'new', source: 'manual', title: 'example.com' }), error: null }) })
  }))
  return {
    from: vi.fn((table) => {
      if (table === 'opportunity_state') {
        return {
          select: vi.fn(() => Promise.resolve({ data: state, error: null })),
          upsert: upsertFn,
        }
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: items, error: null })),
          })),
        })),
        update: updateFn,
        insert: insertFn,
      }
    }),
    _updateFn: updateFn,
    _upsertFn: upsertFn,
    _insertFn: insertFn,
  }
}

test('shows unread badge count', async () => {
  const items = [makeItem({ id: '1' }), makeItem({ id: '2' })]
  render(<OpportunitiesWidget supabase={mockSupabase(items)} onTrack={vi.fn()} />)
  expect(await screen.findByText(/2 new/)).toBeInTheDocument()
})

// Was: `expect(sb._updateFn).toHaveBeenCalled()`, which pinned the bug. The
// widget wrote is_read back onto the shared `opportunities` row — the exact
// cross-user leak migration 0044 moved to `opportunity_state`, and which RLS
// has since turned into a silent no-op for end users.
test('clicking title records read state on the per-user side table', async () => {
  const sb = mockSupabase([makeItem()])
  render(<OpportunitiesWidget supabase={sb} onTrack={vi.fn()} />)
  await screen.findByText(/Stripe — SWE Intern/)
  await userEvent.click(screen.getByRole('link', { name: /Stripe — SWE Intern/ }))
  await waitFor(() => expect(sb._upsertFn).toHaveBeenCalled())
  expect(sb._upsertFn.mock.calls[0][0]).toEqual([
    expect.objectContaining({ opportunity_id: 'a', is_read: true }),
  ])
  expect(sb._updateFn).not.toHaveBeenCalled()
})

test('read and saved flags come from the current user state, not the shared row', async () => {
  const sb = mockSupabase(
    [makeItem({ id: 'a', is_read: true, is_saved: true })],
    [{ opportunity_id: 'a', is_read: false, is_saved: false }],
  )
  render(<OpportunitiesWidget supabase={sb} onTrack={vi.fn()} />)
  // Someone else's read flag on the shared row must not consume this user's badge.
  expect(await screen.findByText(/1 new/)).toBeInTheDocument()
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
