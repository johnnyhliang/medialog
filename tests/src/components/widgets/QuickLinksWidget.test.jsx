import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { test, expect, vi, beforeEach } from 'vitest'
import QuickLinksWidget from '../../../../src/components/widgets/QuickLinksWidget.jsx'

vi.mock('../../../../src/lib/db/quickLinks.js', () => ({
  listQuickLinks: vi.fn(),
  createQuickLink: vi.fn(),
  updateQuickLink: vi.fn(),
  deleteQuickLink: vi.fn(),
}))

const { listQuickLinks, createQuickLink, deleteQuickLink } = await import('../../../../src/lib/db/quickLinks.js')

const rows = [
  { id: '1', label: 'gmail', url: 'https://mail.google.com', note: 'email', position: 0 },
  { id: '2', label: 'calendar', url: 'https://calendar.google.com', note: 'schedule', position: 1 },
  { id: '3', label: 'morning brew', url: 'https://www.morningbrew.com', note: 'newsletter', position: 2 },
  { id: '4', label: 'i hate pdf', url: 'https://www.ihatepdf.cv/', note: 'merge, split, compress PDFs', position: 3 },
  { id: '5', label: 'excalidraw', url: 'https://excalidraw.com', note: 'sketch diagrams', position: 4 },
]

const sb = {}

beforeEach(() => {
  vi.clearAllMocks()
  listQuickLinks.mockResolvedValue(rows)
})

test('renders saved links with notes, opening in a new tab', async () => {
  render(<QuickLinksWidget supabase={sb} />)
  const gmail = (await screen.findByText('gmail')).closest('a')
  expect(gmail.href).toContain('mail.google.com')
  expect(gmail.target).toBe('_blank')
  expect(screen.getByText('merge, split, compress PDFs')).toBeTruthy()
})

test('search matches the note, not just the label', async () => {
  render(<QuickLinksWidget supabase={sb} />)
  await screen.findByText('gmail')
  // "pdf" is in that label too, so search a word that lives only in the note.
  await userEvent.type(screen.getByLabelText('search tools'), 'compress')
  await waitFor(() => expect(screen.queryByText('gmail')).toBeNull())
  expect(screen.getByText('i hate pdf')).toBeTruthy()
})

test('adds a link, defaulting the scheme to https', async () => {
  createQuickLink.mockResolvedValue({ id: '6', label: 'regex101', url: 'https://regex101.com', note: 'test regexes' })
  render(<QuickLinksWidget supabase={sb} />)
  await screen.findByText('gmail')
  await userEvent.click(screen.getByText('edit'))

  await userEvent.type(screen.getByLabelText('new link name'), 'regex101')
  await userEvent.type(screen.getByLabelText('new link url'), 'regex101.com')
  await userEvent.type(screen.getByLabelText('new link note'), 'test regexes')
  await userEvent.click(screen.getByText('add'))

  await waitFor(() => expect(createQuickLink).toHaveBeenCalled())
  expect(createQuickLink.mock.calls[0][1]).toMatchObject({
    label: 'regex101',
    url: 'https://regex101.com',
    note: 'test regexes',
  })
})

test('removes a link', async () => {
  deleteQuickLink.mockResolvedValue()
  render(<QuickLinksWidget supabase={sb} />)
  await screen.findByText('gmail')
  await userEvent.click(screen.getByText('edit'))
  await userEvent.click(screen.getByLabelText('remove gmail'))

  await waitFor(() => expect(deleteQuickLink).toHaveBeenCalledWith(sb, '1'))
  await userEvent.click(screen.getByText('done'))
  expect(screen.queryByText('gmail')).toBeNull()
})

test('shows an empty state when there are no links', async () => {
  listQuickLinks.mockResolvedValue([])
  render(<QuickLinksWidget supabase={sb} />)
  expect(await screen.findByText(/no tools yet/)).toBeTruthy()
})

const { updateQuickLink } = await import('../../../../src/lib/db/quickLinks.js')

// Paired with 'shows an empty state when there are no links' above: the shelf
// must be able to say "the load failed" and "you have no links" differently.
test('a failed load says so instead of showing an empty shelf', async () => {
  listQuickLinks.mockRejectedValue(new Error('network down'))
  render(<QuickLinksWidget supabase={sb} />)
  expect(await screen.findByText(/network down/)).toBeTruthy()
  // "no tools yet — hit edit to add one" would invite re-adding links that exist
  expect(screen.queryByText(/no tools yet/)).toBeNull()
})

test('a failed add keeps the draft and does not show the link as saved', async () => {
  createQuickLink.mockRejectedValue(new Error('insert rejected'))
  render(<QuickLinksWidget supabase={sb} />)
  await screen.findByText('gmail')
  await userEvent.click(screen.getByText('edit'))
  await userEvent.type(screen.getByLabelText('new link name'), 'regex101')
  await userEvent.type(screen.getByLabelText('new link url'), 'regex101.com')
  await userEvent.click(screen.getByText('add'))

  expect(await screen.findByText(/insert rejected/)).toBeTruthy()
  // the row must not appear as an edit row — that would be a lie about the db
  expect(screen.queryByLabelText('label for regex101')).toBeNull()
  // and what was typed is still there to retry with
  expect(screen.getByLabelText('new link name').value).toBe('regex101')
})

test('a failed delete leaves the link on screen and re-reads the server', async () => {
  deleteQuickLink.mockRejectedValue(new Error('delete rejected'))
  render(<QuickLinksWidget supabase={sb} />)
  await screen.findByText('gmail')
  await userEvent.click(screen.getByText('edit'))
  await userEvent.click(screen.getByLabelText('remove gmail'))

  expect(await screen.findByText(/delete rejected/)).toBeTruthy()
  // still present, because the row was never removed optimistically
  expect(screen.getByLabelText('label for gmail')).toBeTruthy()
})

test('a failed edit re-reads the server rather than rolling back a keystroke', async () => {
  updateQuickLink.mockRejectedValue(new Error('update rejected'))
  render(<QuickLinksWidget supabase={sb} />)
  await screen.findByText('gmail')
  await userEvent.click(screen.getByText('edit'))
  // Two keystrokes: a remembered-previous-value rollback would restore 'gmailx'
  // (the last optimistic value) rather than the persisted 'gmail'. See
  // docs/tech-debt.md #5 — re-reading is the only thing that works.
  await userEvent.type(screen.getByLabelText('label for gmail'), 'xy')

  await waitFor(() => expect(screen.getByText(/update rejected/)).toBeTruthy())
  await waitFor(() => expect(screen.getByLabelText('label for gmail').value).toBe('gmail'))
  expect(listQuickLinks.mock.calls.length).toBeGreaterThan(1)
})
