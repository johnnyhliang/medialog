import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import AssistantPanel from './AssistantPanel.jsx'

vi.mock('../lib/db/librarian.js', () => ({ askLibrarian: vi.fn() }))
import { askLibrarian } from '../lib/db/librarian.js'

beforeEach(() => vi.clearAllMocks())

test('shows starter suggestions before any question', () => {
  render(<AssistantPanel supabase={{}} onOpenEntry={vi.fn()} onClose={vi.fn()} />)
  expect(screen.getByText(/ask anything about what you/i)).toBeTruthy()
})

test('sends a question and renders the grounded answer', async () => {
  askLibrarian.mockResolvedValue({
    answer: 'Makers earn the spread [1].',
    sources: [{ n: 1, entryId: 'e1', title: 'Trading', heading: null, anchor: null }],
    usedContext: true,
  })
  render(<AssistantPanel supabase={{}} onOpenEntry={vi.fn()} onClose={vi.fn()} />)
  fireEvent.change(screen.getByPlaceholderText(/ask your library/i), { target: { value: 'how do makers earn' } })
  fireEvent.keyDown(screen.getByPlaceholderText(/ask your library/i), { key: 'Enter' })
  expect(await screen.findByText(/Makers earn the spread/)).toBeTruthy()
  expect(askLibrarian).toHaveBeenCalledWith({}, 'how do makers earn', expect.objectContaining({ history: [] }))
})

test('clicking a citation opens the source entry', async () => {
  const onOpen = vi.fn()
  askLibrarian.mockResolvedValue({
    answer: 'See [1].',
    sources: [{ n: 1, entryId: 'e1', title: 'Trading', heading: 'spread', anchor: 'sp' }],
    usedContext: true,
  })
  render(<AssistantPanel supabase={{}} onOpenEntry={onOpen} onClose={vi.fn()} />)
  fireEvent.change(screen.getByPlaceholderText(/ask your library/i), { target: { value: 'q' } })
  fireEvent.keyDown(screen.getByPlaceholderText(/ask your library/i), { key: 'Enter' })
  const chip = await screen.findByRole('button', { name: '1' })
  fireEvent.click(chip)
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e1' }))
})

test('carries prior turns as history on a follow-up', async () => {
  askLibrarian.mockResolvedValue({ answer: 'a1', sources: [], usedContext: true })
  render(<AssistantPanel supabase={{}} onOpenEntry={vi.fn()} onClose={vi.fn()} />)
  const box = screen.getByPlaceholderText(/ask your library/i)
  fireEvent.change(box, { target: { value: 'first' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  await screen.findByText('a1')
  fireEvent.change(box, { target: { value: 'second' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  await waitFor(() => {
    const lastCall = askLibrarian.mock.calls.at(-1)
    expect(lastCall[1]).toBe('second')
    expect(lastCall[2].history).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'a1' },
    ])
  })
})

test('close button fires onClose', () => {
  const onClose = vi.fn()
  render(<AssistantPanel supabase={{}} onOpenEntry={vi.fn()} onClose={onClose} />)
  fireEvent.click(screen.getByLabelText(/close assistant/i))
  expect(onClose).toHaveBeenCalled()
})
