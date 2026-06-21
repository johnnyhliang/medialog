import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import KeywordsTab from './KeywordsTab.jsx'

function mockSupabase(keywords = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } } })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: { user_id: 'u1', radar_keywords: keywords }, error: null })),
        })),
      })),
      update: updateFn,
    })),
    _updateFn: updateFn,
  }
}

test('renders existing keywords as chips', async () => {
  render(<KeywordsTab supabase={mockSupabase(['internship', 'fellowship'])} />)
  expect(await screen.findByText('internship')).toBeInTheDocument()
  expect(screen.getByText('fellowship')).toBeInTheDocument()
})

test('adding a keyword calls update', async () => {
  const sb = mockSupabase(['internship'])
  render(<KeywordsTab supabase={sb} />)
  await screen.findByText('internship')
  await userEvent.type(screen.getByPlaceholderText(/keyword/i), 'fellowship')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(sb._updateFn).toHaveBeenCalled()
})

test('removing a keyword calls update', async () => {
  const sb = mockSupabase(['internship'])
  render(<KeywordsTab supabase={sb} />)
  await screen.findByText('internship')
  await userEvent.click(screen.getByRole('button', { name: '×' }))
  expect(sb._updateFn).toHaveBeenCalled()
})
