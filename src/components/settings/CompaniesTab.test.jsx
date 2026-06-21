import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import CompaniesTab from './CompaniesTab.jsx'

function mockRow(overrides = {}) {
  return { id: 'c1', slug: 'stripe', name: 'Stripe', ats: 'greenhouse', tags: ['startup'], enabled: true, ...overrides }
}

function mockSupabase(rows = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const deleteFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: mockRow({ id: 'new' }), error: null }) })
  }))
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: rows, error: null })) })),
      update: updateFn,
      delete: deleteFn,
      insert: insertFn,
    })),
    _updateFn: updateFn,
    _deleteFn: deleteFn,
    _insertFn: insertFn,
  }
}

test('renders company rows', async () => {
  render(<CompaniesTab supabase={mockSupabase([mockRow()])} />)
  expect(await screen.findByText('Stripe')).toBeInTheDocument()
  expect(screen.getByText('stripe')).toBeInTheDocument()
})

test('toggling enabled calls update', async () => {
  const sb = mockSupabase([mockRow()])
  render(<CompaniesTab supabase={sb} />)
  await screen.findByText('Stripe')
  const checkbox = screen.getByRole('checkbox')
  await userEvent.click(checkbox)
  expect(sb._updateFn).toHaveBeenCalled()
})

test('delete button calls delete', async () => {
  const sb = mockSupabase([mockRow()])
  render(<CompaniesTab supabase={sb} />)
  await screen.findByText('Stripe')
  await userEvent.click(screen.getByRole('button', { name: '×' }))
  expect(sb._deleteFn).toHaveBeenCalled()
})

test('add form inserts new company', async () => {
  const sb = mockSupabase([])
  render(<CompaniesTab supabase={sb} />)
  await waitFor(() => {})
  await userEvent.type(screen.getByPlaceholderText('slug'), 'linear')
  await userEvent.type(screen.getByPlaceholderText('Display name'), 'Linear')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(sb._insertFn).toHaveBeenCalled()
})
