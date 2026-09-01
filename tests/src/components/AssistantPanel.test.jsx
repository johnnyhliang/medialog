import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import AssistantPanel from '../../../src/components/AssistantPanel.jsx'

vi.mock('../../../src/lib/db/librarian.js', () => ({ askLibrarian: vi.fn() }))
import { askLibrarian } from '../../../src/lib/db/librarian.js'

vi.mock('../../../src/lib/db/conversations.js', () => ({
  listConversations: vi.fn(() => Promise.resolve([])),
  createConversation: vi.fn(),
  listMessages: vi.fn(() => Promise.resolve([])),
  addMessage: vi.fn(),
  touchConversation: vi.fn(),
  deleteConversation: vi.fn(() => Promise.resolve()),
  titleFromQuestion: vi.fn((q) => q),
}))
import { listConversations, deleteConversation } from '../../../src/lib/db/conversations.js'

beforeEach(() => {
  vi.clearAllMocks()
  listConversations.mockResolvedValue([])
})

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

// Deleting a saved thread is irreversible and the trash button sits inside the row
// you click to open one, so a misclick used to destroy a conversation outright.
const CONVOS = [{ id: 'c1', title: 'Market making notes', updated_at: '2026-07-01' }]

async function openHistory(supabase = { from: vi.fn() }) {
  listConversations.mockResolvedValue(CONVOS)
  render(<AssistantPanel supabase={supabase} onOpenEntry={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(await screen.findByLabelText(/conversation history/i))
  return screen.findByText('Market making notes')
}

test('deleting a conversation asks first and does not delete on cancel', async () => {
  await openHistory()
  fireEvent.click(screen.getByLabelText(/delete market making notes/i))

  // Naming the thread matters: a bare "Are you sure?" gives no way to catch that
  // the wrong row's button was hit.
  expect(await screen.findByText(/Market making notes.*gone for good/s)).toBeTruthy()
  expect(deleteConversation).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
  await waitFor(() => expect(screen.queryByText(/gone for good/)).toBeNull())
  expect(deleteConversation).not.toHaveBeenCalled()
  expect(screen.getByText('Market making notes')).toBeTruthy()
})

test('confirming the prompt deletes the conversation and drops the row', async () => {
  await openHistory()
  fireEvent.click(screen.getByLabelText(/delete market making notes/i))
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(deleteConversation).toHaveBeenCalledWith(expect.anything(), 'c1'))
  await waitFor(() => expect(screen.queryByText('Market making notes')).toBeNull())
})

test('a rejected askLibrarian surfaces the reason and stops the spinner', async () => {
  askLibrarian.mockRejectedValue(new Error('Edge Function returned a non-2xx status code'))
  render(<AssistantPanel supabase={{}} onOpenEntry={vi.fn()} onClose={vi.fn()} />)
  const box = screen.getByPlaceholderText(/ask your library/i)
  fireEvent.change(box, { target: { value: 'anything' } })
  fireEvent.keyDown(box, { key: 'Enter' })

  expect(await screen.findByText(/non-2xx/)).toBeTruthy()
  // the panel must not claim the library is empty, and must not spin forever
  expect(screen.queryByText(/couldn.t find anything in your notes/i)).toBeNull()
  await waitFor(() => expect(screen.queryByText(/searching your notes/i)).toBeNull())
  expect(screen.getByText(/not a statement about your notes/i)).toBeTruthy()
})

test('an outage answer is marked, a real no-results answer is not', async () => {
  askLibrarian.mockResolvedValue({
    answer: "I couldn't reach the search service, so I haven't looked at your notes at all. (fetch failed)",
    sources: [], usedContext: false, retrievalFailed: true, error: true,
  })
  const { unmount } = render(<AssistantPanel supabase={{}} onOpenEntry={vi.fn()} onClose={vi.fn()} />)
  let box = screen.getByPlaceholderText(/ask your library/i)
  fireEvent.change(box, { target: { value: 'q' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  expect(await screen.findByText(/not a statement about your notes/i)).toBeTruthy()
  unmount()

  askLibrarian.mockResolvedValue({
    answer: "I couldn't find anything in your notes about that.",
    sources: [], usedContext: false,
  })
  render(<AssistantPanel supabase={{}} onOpenEntry={vi.fn()} onClose={vi.fn()} />)
  box = screen.getByPlaceholderText(/ask your library/i)
  fireEvent.change(box, { target: { value: 'q' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  expect(await screen.findByText(/couldn.t find anything in your notes/i)).toBeTruthy()
  expect(screen.queryByText(/not a statement about your notes/i)).toBeNull()
})
