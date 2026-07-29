import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { test, expect, vi, beforeEach } from 'vitest'
import QuickLinksWidget from './QuickLinksWidget.jsx'

vi.mock('../../lib/db/quickLinks.js', () => ({
  listQuickLinks: vi.fn(),
  createQuickLink: vi.fn(),
  updateQuickLink: vi.fn(),
  deleteQuickLink: vi.fn(),
}))

const { listQuickLinks, createQuickLink, deleteQuickLink } = await import('../../lib/db/quickLinks.js')

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
