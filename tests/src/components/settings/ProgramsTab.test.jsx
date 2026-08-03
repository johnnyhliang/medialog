import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import ProgramsTab from '../../../../src/components/settings/ProgramsTab.jsx'

function mockProgram(overrides = {}) {
  return {
    id: 'p1', name: 'Neo Scholars', url: 'https://neo.com',
    category: 'program', deadline: null, window_open: false, notes: null,
    ...overrides,
  }
}

// `failWrites` mocks a rejected write (RLS, offline, constraint). Every test here
// used to pass `error: null`, so the failure path — the one where the UI claimed a
// save that never happened — had no coverage at all.
function mockSupabase(programs = [], { failWrites = false } = {}) {
  const writeError = failWrites ? { message: 'permission denied' } : null
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: writeError })) }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({
      data: failWrites ? null : mockProgram({ id: 'new', name: 'New Program' }),
      error: writeError,
    }) })
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

test('a failed toggle reverts the badge instead of showing a save that did not happen', async () => {
  const addToast = vi.fn()
  const sb = mockSupabase([mockProgram({ window_open: false })], { failWrites: true })
  render(<ProgramsTab supabase={sb} addToast={addToast} />)
  await screen.findByText('Neo Scholars')

  await userEvent.click(screen.getByRole('button', { name: 'closed' }))

  // The optimistic flip must be undone: leaving it 'open' is the actual bug —
  // the row looks saved until a reload silently puts it back.
  await waitFor(() => expect(screen.getByRole('button', { name: 'closed' })).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'open' })).not.toBeInTheDocument()
  expect(addToast).toHaveBeenCalledWith(expect.stringContaining('permission denied'), 'error')
})

test('a failed deadline edit reverts to the previous date', async () => {
  const addToast = vi.fn()
  const sb = mockSupabase([mockProgram({ deadline: '2026-03-01' })], { failWrites: true })
  const { container } = render(<ProgramsTab supabase={sb} addToast={addToast} />)
  await screen.findByText('Neo Scholars')
  const date = container.querySelector('input[type="date"]')
  expect(date.value).toBe('2026-03-01')

  // One deterministic change event: userEvent.type on a date input emits a
  // per-keystroke sequence of partially-invalid values, which tests jsdom's date
  // parsing rather than the revert this test is about.
  fireEvent.change(date, { target: { value: '2026-09-09' } })

  await waitFor(() => expect(container.querySelector('input[type="date"]').value).toBe('2026-03-01'))
  expect(addToast).toHaveBeenCalledWith(expect.stringContaining('permission denied'), 'error')
})

test('a failed add keeps the typed values instead of clearing the form', async () => {
  const addToast = vi.fn()
  const sb = mockSupabase([], { failWrites: true })
  render(<ProgramsTab supabase={sb} addToast={addToast} />)
  await waitFor(() => {})
  await userEvent.click(screen.getByRole('button', { name: '+ add program' }))
  await userEvent.type(screen.getByPlaceholderText('Program name'), 'New Program')
  await userEvent.type(screen.getByPlaceholderText('URL'), 'https://example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringContaining('permission denied'), 'error'))
  // Form stays open and populated — clearing it would discard the user's typing
  // for a program that was never created.
  expect(screen.getByPlaceholderText('Program name')).toHaveValue('New Program')
})

test('notes are written, not silently dropped', async () => {
  const sb = mockSupabase([])
  render(<ProgramsTab supabase={sb} />)
  await waitFor(() => {})
  await userEvent.click(screen.getByRole('button', { name: '+ add program' }))
  await userEvent.type(screen.getByPlaceholderText('Program name'), 'New Program')
  await userEvent.type(screen.getByPlaceholderText('URL'), 'https://example.com')
  await userEvent.type(screen.getByPlaceholderText('Optional'), 'referral from Dana')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(sb._insertFn).toHaveBeenCalledWith(expect.objectContaining({ notes: 'referral from Dana' }))
})
