import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import TidyView, { reason } from '../../../src/components/TidyView.jsx'
import { listTidyQueue } from '../../../src/lib/db/tidy.js'
import { updateEntry, softDeleteEntry, snoozeEntry } from '../../../src/lib/db/entries.js'

// TidyView is the app's only triage surface: every state change to an entry
// that isn't made from the entry itself is made here. The db layer is mocked
// because what needs asserting is which write each button performs and how the
// queue advances — the queries themselves are covered in tidy.test.js.
vi.mock('../../../src/lib/db/tidy.js', () => ({ listTidyQueue: vi.fn() }))
vi.mock('../../../src/lib/db/entries.js', () => ({
  updateEntry: vi.fn(),
  softDeleteEntry: vi.fn(),
  snoozeEntry: vi.fn(),
}))

const supabase = {}
const topics = [
  { id: 'inbox', name: 'Inbox' },
  { id: 't1', name: 'Systems' },
  { id: 't2', name: 'Archived thing', archived_at: '2026-01-01' },
]

const card = (over = {}) => ({
  id: 'e1',
  topic_id: 'inbox',
  title: 'A capture',
  url: null,
  note: null,
  tidySource: 'inbox',
  tidySince: new Date(Date.now() - 5 * 86400000).toISOString(),
  ...over,
})

function setup(queue, props = {}) {
  listTidyQueue.mockResolvedValue(queue)
  const addToast = vi.fn()
  const onTriaged = vi.fn()
  const utils = render(
    <TidyView
      supabase={supabase}
      topics={topics}
      inboxTopicId="inbox"
      addToast={addToast}
      onTriaged={onTriaged}
      {...props}
    />,
  )
  return { addToast, onTriaged, ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
  updateEntry.mockResolvedValue({})
  softDeleteEntry.mockResolvedValue()
  snoozeEntry.mockResolvedValue()
})

describe('reason', () => {
  test('phrases anything under a day in words, not "0d"', () => {
    const now = new Date().toISOString()
    expect(reason({ tidySource: 'inbox', tidySince: now })).toBe('just captured')
    expect(reason({ tidySource: 'stale', tidySince: now })).toBe('untouched today')
  })

  test('counts days once there is a day to count', () => {
    const since = new Date(Date.now() - 3 * 86400000).toISOString()
    expect(reason({ tidySource: 'inbox', tidySince: since })).toBe('in inbox 3d')
    expect(reason({ tidySource: 'stale', tidySince: since })).toBe('untouched 3d')
  })
})

describe('TidyView', () => {
  test('shows the first card, its reason, and the queue position', async () => {
    setup([card(), card({ id: 'e2', title: 'Second' })])
    expect(await screen.findByText('A capture')).toBeInTheDocument()
    expect(screen.getByText('in inbox 5d')).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  test('offers only unarchived, non-Inbox topics as move targets', async () => {
    setup([card()])
    await screen.findByText('A capture')
    const options = [...screen.getByRole('combobox').options].map((o) => o.textContent)
    expect(options).toEqual(['move to topic…', 'Systems'])
  })

  test('move files the entry, advances, and reports it as leaving the inbox', async () => {
    const { onTriaged } = setup([card(), card({ id: 'e2', title: 'Second' })])
    await screen.findByText('A capture')
    expect(screen.getByRole('button', { name: 'move' })).toBeDisabled()

    await userEvent.selectOptions(screen.getByRole('combobox'), 't1')
    await userEvent.click(screen.getByRole('button', { name: 'move' }))

    expect(updateEntry).toHaveBeenCalledWith(supabase, 'e1', { topic_id: 't1' })
    expect(onTriaged).toHaveBeenCalledWith('e1', { filed: true })
    expect(await screen.findByText('Second')).toBeInTheDocument()
    // The move target resets, or the next card arrives pre-aimed at a topic
    // the user picked for a different entry.
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  test('done reading marks the entry done but does not report it as leaving the inbox', async () => {
    // The nav inbox badge lives in App and cannot see these writes, so only
    // actions that actually take a row out of the Inbox topic may be reported.
    // Done leaves the entry where it is; reporting it would drift the badge low.
    const { onTriaged } = setup([card(), card({ id: 'e2', title: 'Second' })])
    await screen.findByText('A capture')
    await userEvent.click(screen.getByRole('button', { name: 'done reading' }))
    expect(updateEntry).toHaveBeenCalledWith(supabase, 'e1', { status: 'done' })
    expect(onTriaged).not.toHaveBeenCalled()
    expect(await screen.findByText('Second')).toBeInTheDocument()
  })

  test('snooze pushes the entry 30 days out and does not report it', async () => {
    const { onTriaged } = setup([card()])
    await screen.findByText('A capture')
    await userEvent.click(screen.getByRole('button', { name: 'snooze 30d' }))
    const [, id, iso] = snoozeEntry.mock.calls[0]
    expect(id).toBe('e1')
    const days = (new Date(iso).getTime() - Date.now()) / 86400000
    expect(days).toBeGreaterThan(29)
    expect(days).toBeLessThan(31)
    expect(onTriaged).not.toHaveBeenCalled()
  })

  test('trash soft-deletes and reports the entry as leaving the inbox, unfiled', async () => {
    const { onTriaged } = setup([card()])
    await screen.findByText('A capture')
    await userEvent.click(screen.getByRole('button', { name: 'trash' }))
    expect(softDeleteEntry).toHaveBeenCalledWith(supabase, 'e1')
    expect(onTriaged).toHaveBeenCalledWith('e1', { filed: false })
  })

  test('a card that is not in the inbox is never reported to the badge', async () => {
    const { onTriaged } = setup([card({ topic_id: 't1', tidySource: 'stale' })])
    await screen.findByText('A capture')
    await userEvent.click(screen.getByRole('button', { name: 'trash' }))
    expect(softDeleteEntry).toHaveBeenCalled()
    expect(onTriaged).not.toHaveBeenCalled()
  })

  test('skip advances without writing anything and without counting a decision', async () => {
    setup([card(), card({ id: 'e2', title: 'Second' })])
    await screen.findByText('A capture')
    await userEvent.click(screen.getByRole('button', { name: 'skip' }))
    expect(await screen.findByText('Second')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'skip' }))
    expect(updateEntry).not.toHaveBeenCalled()
    expect(await screen.findByText('all tidy')).toBeInTheDocument()
    // Skipping is explicitly not a decision — the tally stays at zero.
    expect(screen.getByText(/Nothing needs a decision right now/)).toBeInTheDocument()
  })

  test('a failed action toasts and keeps the same card up', async () => {
    const { addToast } = setup([card(), card({ id: 'e2', title: 'Second' })])
    await screen.findByText('A capture')
    updateEntry.mockRejectedValueOnce(new Error('nope'))
    await userEvent.click(screen.getByRole('button', { name: 'done reading' }))
    await waitFor(() => expect(addToast).toHaveBeenCalledWith('Failed to mark done', 'error'))
    // Not advancing is the point: the decision was not recorded, so the user
    // must get another go at it rather than have it scroll past.
    expect(screen.getByText('A capture')).toBeInTheDocument()
  })

  test('an empty queue is the reward screen, not an error', async () => {
    setup([])
    expect(await screen.findByText('all tidy')).toBeInTheDocument()
    expect(screen.getByText(/Nothing needs a decision right now/)).toBeInTheDocument()
  })

  test('a decision count is reported once the queue runs out', async () => {
    setup([card()])
    await screen.findByText('A capture')
    await userEvent.click(screen.getByRole('button', { name: 'done reading' }))
    expect(await screen.findByText(/1 decision made/)).toBeInTheDocument()
  })

  test('a failed load toasts instead of silently claiming everything is tidy', async () => {
    listTidyQueue.mockRejectedValue(new Error('db down'))
    const addToast = vi.fn()
    render(
      <TidyView supabase={supabase} topics={topics} inboxTopicId="inbox" addToast={addToast} />,
    )
    await waitFor(() => expect(addToast).toHaveBeenCalledWith('db down', 'error'))
  })

  test('clicking the title opens the entry', async () => {
    const onOpenEntry = vi.fn()
    const rows = [card()]
    setup(rows, { onOpenEntry })
    await userEvent.click(await screen.findByRole('button', { name: 'A capture' }))
    expect(onOpenEntry).toHaveBeenCalledWith(rows[0])
  })

  test('a url card shows the bare hostname and links out', async () => {
    setup([card({ title: null, url: 'https://www.example.com/a/b' })])
    const link = await screen.findByRole('link')
    expect(link).toHaveAttribute('href', 'https://www.example.com/a/b')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link.textContent).toContain('example.com')
  })
})
