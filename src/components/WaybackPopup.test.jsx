import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import WaybackPopup from './WaybackPopup.jsx'

vi.mock('../lib/wayback.js', () => ({
  checkArchive: vi.fn(),
  submitArchive: vi.fn(),
}))
vi.mock('../lib/db/entries.js', () => ({
  updateEntry: vi.fn(),
}))

import { checkArchive, submitArchive } from '../lib/wayback.js'
import { updateEntry } from '../lib/db/entries.js'

const entry = { id: 'e1', url: 'https://example.com', title: 'Example', wayback_submitted_at: null }
const supabase = {}
const noop = () => {}

beforeEach(() => { vi.clearAllMocks() })

test('shows loading then archived status', async () => {
  checkArchive.mockResolvedValue({ archived: true, timestamp: '2024-01-15T10:00:00.000Z', snapshotUrl: 'https://web.archive.org/web/20240115/https://example.com' })

  render(<WaybackPopup entry={entry} supabase={supabase} onClose={noop} onEntryUpdate={noop} />)

  expect(screen.getByText(/checking/i)).toBeTruthy()
  await waitFor(() => expect(screen.getByText(/last archived/i)).toBeTruthy())
  expect(screen.getByRole('link', { name: /view snapshot/i })).toBeTruthy()
})

test('shows never archived when no snapshot', async () => {
  checkArchive.mockResolvedValue({ archived: false, timestamp: null, snapshotUrl: null })

  render(<WaybackPopup entry={entry} supabase={supabase} onClose={noop} onEntryUpdate={noop} />)

  await waitFor(() => expect(screen.getByText(/never archived/i)).toBeTruthy())
})

test('submit button calls submitArchive and updateEntry', async () => {
  checkArchive.mockResolvedValue({ archived: false, timestamp: null, snapshotUrl: null })
  submitArchive.mockResolvedValue({ snapshotUrl: 'https://web.archive.org/web/20260620/https://example.com' })
  updateEntry.mockResolvedValue({ ...entry, wayback_submitted_at: '2026-06-20T00:00:00.000Z' })

  const onEntryUpdate = vi.fn()
  render(<WaybackPopup entry={entry} supabase={supabase} onClose={noop} onEntryUpdate={onEntryUpdate} />)

  await waitFor(() => screen.getByRole('button', { name: /archive now/i }))
  await userEvent.click(screen.getByRole('button', { name: /archive now/i }))

  await waitFor(() => expect(submitArchive).toHaveBeenCalledWith('https://example.com'))
  expect(updateEntry).toHaveBeenCalledWith(supabase, 'e1', expect.objectContaining({ wayback_submitted_at: expect.any(String) }))
  expect(onEntryUpdate).toHaveBeenCalled()
})

test('shows previously submitted date when wayback_submitted_at is set', async () => {
  checkArchive.mockResolvedValue({ archived: true, timestamp: '2024-01-15T10:00:00.000Z', snapshotUrl: 'https://web.archive.org/web/20240115/https://example.com' })
  const submittedEntry = { ...entry, wayback_submitted_at: '2026-06-20T12:00:00.000Z' }

  render(<WaybackPopup entry={submittedEntry} supabase={supabase} onClose={noop} onEntryUpdate={noop} />)

  await waitFor(() => expect(screen.getByText(/you submitted this/i)).toBeTruthy())
})

test('shows error when checkArchive throws', async () => {
  checkArchive.mockRejectedValue(new Error('network error'))

  render(<WaybackPopup entry={entry} supabase={supabase} onClose={noop} onEntryUpdate={noop} />)

  await waitFor(() => expect(screen.getByText(/couldn't reach/i)).toBeTruthy())
})
