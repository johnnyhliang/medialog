import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import ReadingView from './ReadingView.jsx'

vi.mock('../lib/db/deepTopics.js', () => ({
  listDeepTopics: vi.fn(async () => [
    { id: 't1', name: 'Trading & Exchanges', source_kind: 'book' },
  ]),
  createDeepTopic: vi.fn(async ({ name }) => ({ id: 't2', name, source_kind: 'web' })),
}))

beforeEach(() => vi.clearAllMocks())

test('lists existing deep topics', async () => {
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  expect(await screen.findByText('Trading & Exchanges')).toBeTruthy()
})

test('opens a topic when clicked', async () => {
  const onOpen = vi.fn()
  render(<ReadingView supabase={{}} onOpenTopic={onOpen} addToast={vi.fn()} />)
  fireEvent.click(await screen.findByText('Trading & Exchanges'))
  expect(onOpen).toHaveBeenCalledWith('t1')
})

test('creates a book resource from the form', async () => {
  const { createDeepTopic } = await import('../lib/db/deepTopics.js')
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /new resource/i }))
  fireEvent.change(screen.getByPlaceholderText(/name/i), { target: { value: 'The Rust Book' } })
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
  await waitFor(() => expect(createDeepTopic).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'The Rust Book' }),
  ))
})
