import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import ReadingView from '../../../src/components/ReadingView.jsx'

vi.mock('../../../src/lib/db/deepTopics.js', () => ({
  listDeepTopics: vi.fn(async () => [
    { id: 't1', name: 'Trading & Exchanges', source_kind: 'book' },
  ]),
  createDeepTopic: vi.fn(async (supabase, { name }) => ({ id: 't2', name, source_kind: 'web' })),
}))

beforeEach(() => vi.clearAllMocks())

async function openForm(name) {
  await screen.findByText('Trading & Exchanges')
  await userEvent.click(screen.getByRole('button', { name: /new resource/i }))
  await userEvent.type(screen.getByPlaceholderText(/^name/i), name)
}

test('lists existing deep topics', async () => {
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  expect(await screen.findByText('Trading & Exchanges')).toBeTruthy()
})

test('opens a topic when clicked', async () => {
  const onOpen = vi.fn()
  render(<ReadingView supabase={{}} onOpenTopic={onOpen} addToast={vi.fn()} />)
  await userEvent.click(await screen.findByText('Trading & Exchanges'))
  expect(onOpen).toHaveBeenCalledWith('t1')
})

test('creates a book resource from the form', async () => {
  const { createDeepTopic } = await import('../../../src/lib/db/deepTopics.js')
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  await openForm('The Rust Book')
  await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
  await waitFor(() => expect(createDeepTopic).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ name: 'The Rust Book' }),
  ))
})

test('book can carry an optional reference url', async () => {
  const { createDeepTopic } = await import('../../../src/lib/db/deepTopics.js')
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  await openForm('Harris')
  await userEvent.type(screen.getByPlaceholderText(/reference url/i), 'https://ref/book')
  await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
  await waitFor(() => expect(createDeepTopic).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ source_kind: 'book', source_url: 'https://ref/book' }),
  ))
})

test('a pasted pdf link is hotlinked, never uploaded', async () => {
  const { createDeepTopic } = await import('../../../src/lib/db/deepTopics.js')
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  await openForm('DDIA')
  await userEvent.selectOptions(screen.getByRole('combobox'), 'pdf')
  await userEvent.type(screen.getByPlaceholderText(/pdf link/i), 'https://x/ddia.pdf')
  await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
  await waitFor(() => expect(createDeepTopic).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ source_kind: 'pdf', source_url: 'https://x/ddia.pdf' }),
  ))
})
