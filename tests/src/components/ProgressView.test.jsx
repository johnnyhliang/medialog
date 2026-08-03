import { render, screen, waitFor } from '@testing-library/react'
import { test, expect, vi, beforeEach } from 'vitest'
import ProgressView from '../../../src/components/ProgressView.jsx'
import * as entriesDb from '../../../src/lib/db/entries.js'

const topics = [{ id: 't1', name: 'AI' }, { id: 't2', name: 'Books' }]

const entries = [
  { id: '1', status: 'done', tags: ['book'], created_at: new Date().toISOString() },
  { id: '2', status: 'done', tags: ['video'], created_at: new Date().toISOString() },
  { id: '3', status: 'active', tags: [], created_at: new Date().toISOString() },
  { id: '4', status: 'backlog', tags: [], created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
]

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.spyOn(entriesDb, 'listEntriesByTopic').mockResolvedValue(entries)
})

test('shows counts per status for the initial topic', async () => {
  render(<ProgressView supabase={{}} topics={topics} initialTopicId="t1" />)
  await waitFor(() => expect(screen.getByText(/Done: 2/)).toBeInTheDocument())
  expect(screen.getByText(/Active: 1/)).toBeInTheDocument()
  expect(screen.getByText(/Backlog: 1/)).toBeInTheDocument()
})

test('shows a completion percentage and oldest-backlog insight', async () => {
  render(<ProgressView supabase={{}} topics={topics} initialTopicId="t1" />)
  await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument())
  expect(screen.getByText('30d')).toBeInTheDocument()
})

test('the topic dropdown lists every topic and starts on initialTopicId', async () => {
  render(<ProgressView supabase={{}} topics={topics} initialTopicId="t2" />)
  await waitFor(() => expect(entriesDb.listEntriesByTopic).toHaveBeenCalledWith({}, 't2'))
  expect(screen.getByRole('combobox').value).toBe('t2')
})

test('remembers the last topic picked here across mounts', async () => {
  const { unmount } = render(<ProgressView supabase={{}} topics={topics} initialTopicId="t1" />)
  await waitFor(() => expect(entriesDb.listEntriesByTopic).toHaveBeenCalledWith({}, 't1'))
  localStorage.setItem('medialog_progress_topic', 't2')
  unmount()

  render(<ProgressView supabase={{}} topics={topics} initialTopicId="t1" />)
  await waitFor(() => expect(entriesDb.listEntriesByTopic).toHaveBeenCalledWith({}, 't2'))
})
