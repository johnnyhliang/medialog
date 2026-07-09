import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import ReadingView from './ReadingView.jsx'

vi.mock('../lib/db/deepTopics.js', () => ({
  listDeepTopics: vi.fn(async (supabase) => [
    { id: 't1', name: 'Trading & Exchanges', source_kind: 'book' },
  ]),
  createDeepTopic: vi.fn(async (supabase, { name }) => ({ id: 't2', name, source_kind: 'web' })),
}))

vi.mock('../lib/storage.js', () => ({
  uploadAttachment: vi.fn(async () => ({ url: 'https://uploaded/f.pdf', thumbUrl: null })),
}))

beforeEach(() => vi.clearAllMocks())

async function openForm(name) {
  fireEvent.click(screen.getByRole('button', { name: /new resource/i }))
  fireEvent.change(screen.getByPlaceholderText(/^name/i), { target: { value: name } })
}

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
  await openForm('The Rust Book')
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
  await waitFor(() => expect(createDeepTopic).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ name: 'The Rust Book' }),
  ))
})

test('book can carry an optional reference url', async () => {
  const { createDeepTopic } = await import('../lib/db/deepTopics.js')
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  await openForm('Harris')
  fireEvent.change(screen.getByPlaceholderText(/reference url/i), { target: { value: 'https://ref/book' } })
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
  await waitFor(() => expect(createDeepTopic).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ source_kind: 'book', source_url: 'https://ref/book' }),
  ))
})

test('a pasted pdf link is hotlinked, never uploaded', async () => {
  const { createDeepTopic } = await import('../lib/db/deepTopics.js')
  const { uploadAttachment } = await import('../lib/storage.js')
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  await openForm('DDIA')
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pdf' } })
  fireEvent.change(screen.getByPlaceholderText(/pdf link/i), { target: { value: 'https://x/ddia.pdf' } })
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
  await waitFor(() => expect(createDeepTopic).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ source_kind: 'pdf', source_url: 'https://x/ddia.pdf' }),
  ))
  expect(uploadAttachment).not.toHaveBeenCalled()
})
