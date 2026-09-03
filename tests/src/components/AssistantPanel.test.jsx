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

vi.mock('../../../src/lib/ai.js', () => ({ classify: vi.fn() }))
import { classify } from '../../../src/lib/ai.js'

vi.mock('../../../src/lib/db/entries.js', () => ({
  createEntry: vi.fn(),
  setDueDate: vi.fn(),
}))
import { createEntry, setDueDate } from '../../../src/lib/db/entries.js'

beforeEach(() => {
  vi.clearAllMocks()
  listConversations.mockResolvedValue([])
  // No AI provider configured is the likely common case, and it is the default
  // here: the router answers "ask" and the panel behaves exactly as it did
  // before capture existed.
  classify.mockResolvedValue(null)
  createEntry.mockResolvedValue({ id: 'e-new' })
  setDueDate.mockResolvedValue()
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

// --- one box, two intents ---------------------------------------------------
// The same textarea takes "what did I conclude about X" and "email the 370
// staff by Friday". Getting the fork wrong in the capture direction writes a
// row the user has to hunt down and delete, so everything uncertain asks.

function ask(text) {
  const box = screen.getByPlaceholderText(/ask your library/i)
  fireEvent.change(box, { target: { value: text } })
  fireEvent.keyDown(box, { key: 'Enter' })
}

function panel(props = {}) {
  return render(
    <AssistantPanel supabase={{}} onOpenEntry={vi.fn()} onClose={vi.fn()} inboxTopicId="t-inbox" {...props} />
  )
}

test('a question is answered and creates no entry', async () => {
  classify.mockResolvedValue({ intent: 'ask', title: null, due_at: null })
  askLibrarian.mockResolvedValue({ answer: 'You concluded X.', sources: [], usedContext: true })
  panel()
  ask('what did I conclude about market making?')
  expect(await screen.findByText(/You concluded X/)).toBeTruthy()
  expect(createEntry).not.toHaveBeenCalled()
})

test('a task is shown for confirmation and only written when confirmed', async () => {
  localStorage.setItem('medialog_timezone', 'America/Detroit')
  classify.mockResolvedValue({
    intent: 'capture',
    title: 'Email the 370 staff about office hours',
    due_at: '2026-09-11',
    estimate_minutes: 30,
  })
  const onCaptured = vi.fn()
  panel({ onCaptured })
  ask('email the 370 staff about office hours by friday')

  const title = await screen.findByLabelText('task title')
  expect(title.value).toBe('Email the 370 staff about office hours')
  expect(screen.getByLabelText('due date').value).toBe('2026-09-11')
  // Nothing is written until the user has looked at it.
  expect(createEntry).not.toHaveBeenCalled()
  expect(askLibrarian).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: /save to inbox/i }))
  await waitFor(() => expect(createEntry).toHaveBeenCalled())

  // The task rides in as the NOTE so the title stays mirrored — passing a title
  // would set title_edited and freeze it against every later note edit.
  expect(createEntry).toHaveBeenCalledWith({}, { topicId: 't-inbox', note: 'Email the 370 staff about office hours' })
  const [, entryId, iso] = setDueDate.mock.calls[0]
  expect(entryId).toBe('e-new')
  // End of the picked LOCAL day. `new Date('2026-09-11')` is UTC midnight,
  // which in Detroit is still the 10th.
  expect(iso).toBe('2026-09-12T03:59:59.999Z')
  expect(new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Detroit' })).toBe('2026-09-11')
  expect(onCaptured).toHaveBeenCalled()
  expect(await screen.findByText(/Saved to Inbox/)).toBeTruthy()
  localStorage.removeItem('medialog_timezone')
})

test('the user can correct the date before it is written', async () => {
  localStorage.setItem('medialog_timezone', 'America/Detroit')
  classify.mockResolvedValue({ intent: 'capture', title: 'Submit the 489 PS', due_at: '2026-09-11' })
  panel()
  ask('remind me to submit the 489 PS monday')
  await screen.findByLabelText('task title')
  fireEvent.change(screen.getByLabelText('due date'), { target: { value: '2026-09-14' } })
  fireEvent.click(screen.getByRole('button', { name: /save to inbox/i }))
  await waitFor(() => expect(setDueDate).toHaveBeenCalled())
  expect(setDueDate.mock.calls[0][2]).toBe('2026-09-15T03:59:59.999Z')
  localStorage.removeItem('medialog_timezone')
})

test('discarding a proposed capture writes nothing', async () => {
  classify.mockResolvedValue({ intent: 'capture', title: 'Do the thing', due_at: null })
  panel()
  ask('do the thing')
  await screen.findByLabelText('task title')
  fireEvent.click(screen.getByRole('button', { name: /discard/i }))
  await waitFor(() => expect(screen.queryByLabelText('task title')).toBeNull())
  expect(createEntry).not.toHaveBeenCalled()
})

test('a misrouted capture can be answered instead, without retyping', async () => {
  classify.mockResolvedValue({ intent: 'capture', title: 'Read the RAG notes', due_at: null })
  askLibrarian.mockResolvedValue({ answer: 'Here is what you wrote.', sources: [] })
  panel()
  ask('read my RAG notes')
  await screen.findByLabelText('task title')
  fireEvent.click(screen.getByRole('button', { name: /answer it instead/i }))
  expect(await screen.findByText(/Here is what you wrote/)).toBeTruthy()
  expect(askLibrarian).toHaveBeenCalledWith({}, 'read my RAG notes', expect.anything())
  expect(createEntry).not.toHaveBeenCalled()
})

test('an ambiguous or unroutable message falls through to asking', async () => {
  // classify returns null for a provider error, a timeout, malformed JSON, and
  // an `ai` function with no provider configured at all. None of those may turn
  // into a written task, and none of them may lose the message.
  classify.mockResolvedValue(null)
  askLibrarian.mockResolvedValue({ answer: 'Nothing found.', sources: [] })
  panel()
  ask('office hours friday')
  expect(await screen.findByText('Nothing found.')).toBeTruthy()
  expect(screen.getByText('office hours friday')).toBeTruthy()
  expect(createEntry).not.toHaveBeenCalled()
})

test('an intent the model invented is treated as a question', async () => {
  classify.mockResolvedValue({ intent: 'reminder', title: 'Do it', due_at: '2030-01-01' })
  askLibrarian.mockResolvedValue({ answer: 'Nothing found.', sources: [] })
  panel()
  ask('do it')
  expect(await screen.findByText('Nothing found.')).toBeTruthy()
  expect(createEntry).not.toHaveBeenCalled()
})

test('a failed write leaves the card up and says so', async () => {
  classify.mockResolvedValue({ intent: 'capture', title: 'Do the thing', due_at: null })
  createEntry.mockRejectedValue(new Error('row level security'))
  panel()
  ask('do the thing')
  await screen.findByLabelText('task title')
  fireEvent.click(screen.getByRole('button', { name: /save to inbox/i }))
  expect(await screen.findByText(/row level security/)).toBeTruthy()
  expect(screen.getByLabelText('task title')).toBeTruthy()
})

test('the mic control is absent when the browser has no Speech API', () => {
  // jsdom defines neither constructor. A button that silently does nothing when
  // tapped is worse than no button.
  panel()
  expect(screen.queryByRole('button', { name: /dictate/i })).toBeNull()
})
