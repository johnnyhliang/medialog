import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import ProgramsTab from './ProgramsTab.jsx'

function mockProgram(overrides = {}) {
  return {
    id: 'p1', name: 'Neo Scholars', url: 'https://neo.com',
    category: 'program', deadline: null, window_open: false, notes: null,
    ...overrides,
  }
}

function mockSupabase(programs = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: mockProgram({ id: 'new', name: 'New Program' }), error: null }) })
  }))
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: programs, error: null })) })),
      update: updateFn,
      insert: insertFn,
    })),
    _updateFn: updateFn,
    _insertFn: insertFn,
  }
}

test('renders program rows', async () => {
  render(<ProgramsTab supabase={mockSupabase([mockProgram()])} />)
  expect(await screen.findByText('Neo Scholars')).toBeInTheDocument()
})

test('clicking window badge toggles window_open', async () => {
  const sb = mockSupabase([mockProgram({ window_open: false })])
  render(<ProgramsTab supabase={sb} />)
  await screen.findByText('Neo Scholars')
  await userEvent.click(screen.getByRole('button', { name: 'closed' }))
  expect(sb._updateFn).toHaveBeenCalled()
})

test('add form inserts a new program', async () => {
  const sb = mockSupabase([])
  render(<ProgramsTab supabase={sb} />)
  await waitFor(() => {})
  await userEvent.click(screen.getByRole('button', { name: '+ add program' }))
  await userEvent.type(screen.getByPlaceholderText('Program name'), 'New Program')
  await userEvent.type(screen.getByPlaceholderText('URL'), 'https://example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(sb._insertFn).toHaveBeenCalled()
})
