import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import ApplicationsView from './ApplicationsView.jsx'

function mockApp(overrides = {}) {
  return {
    id: 'a1',
    company: 'Anthropic',
    role: 'Research Engineer',
    url: 'https://anthropic.com',
    status: 'applied',
    applied_at: '2026-06-01',
    deadline: null,
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    opportunity_id: null,
    ...overrides,
  }
}

function mockSupabase(apps = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const deleteFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: mockApp(), error: null }) })
  }))
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: apps, error: null })) })),
      update: updateFn,
      delete: deleteFn,
      insert: insertFn,
    })),
    _updateFn: updateFn,
    _deleteFn: deleteFn,
    _insertFn: insertFn,
  }
}

test('shows application in correct status tab', async () => {
  render(<ApplicationsView supabase={mockSupabase([mockApp()])} prefill={null} onClearPrefill={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Applied/ }))
  expect(screen.getByText('Anthropic')).toBeInTheDocument()
  expect(screen.getByText('Research Engineer')).toBeInTheDocument()
})

test('clicking status badge cycles to next status', async () => {
  const sb = mockSupabase([mockApp()])
  render(<ApplicationsView supabase={sb} prefill={null} onClearPrefill={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Applied/ }))
  const badge = screen.getByRole('button', { name: 'Applied' })
  await userEvent.click(badge)
  expect(sb._updateFn).toHaveBeenCalled()
})

test('prefill opens add form with company + role', async () => {
  const prefill = { id: 'opp1', company: 'Stripe', title: 'SWE Intern', url: 'https://stripe.com' }
  render(<ApplicationsView supabase={mockSupabase([])} prefill={prefill} onClearPrefill={vi.fn()} />)
  await waitFor(() => {
    expect(screen.getByDisplayValue('Stripe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('SWE Intern')).toBeInTheDocument()
  })
})

test('shows error toast when status update fails', async () => {
  const failSupabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [mockApp()], error: null })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: { message: 'network error' } })) })),
    })),
  }
  const addToast = vi.fn()
  render(<ApplicationsView supabase={failSupabase} prefill={null} onClearPrefill={vi.fn()} addToast={addToast} />)
  await userEvent.click(await screen.findByRole('button', { name: /Applied/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Applied' }))
  await waitFor(() => {
    expect(addToast).toHaveBeenCalledWith('Failed to update status', 'error')
  })
})

test('delete requires confirmation', async () => {
  const sb = mockSupabase([mockApp()])
  render(<ApplicationsView supabase={sb} prefill={null} onClearPrefill={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Applied/ }))
  await userEvent.click(screen.getByRole('button', { name: '×' }))
  expect(screen.getByText(/Delete this application/)).toBeInTheDocument()
  expect(sb._deleteFn).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
  expect(sb._deleteFn).toHaveBeenCalled()
})
