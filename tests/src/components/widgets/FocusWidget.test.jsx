import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import FocusWidget, { parseNext } from '../../../../src/components/widgets/FocusWidget.jsx'
import { getFocusEntry } from '../../../../src/lib/db/review.js'

// The query moved to `src/lib/db/review.js`, where its filters are asserted
// against a fake client. Mocking the db function keeps these tests about what
// the widget renders, and — unlike the chain mock it replaces — lets a failure
// be expressed at all: the old one could only ever resolve.
vi.mock('../../../../src/lib/db/review.js', () => ({ getFocusEntry: vi.fn() }))

// Kept as a factory so the test bodies read unchanged; the argument is now the
// row the db layer resolves with rather than a raw Supabase result.
function mockSupabase(rows = []) {
  getFocusEntry.mockResolvedValue(rows[0] ?? null)
  return {}
}

function makeEntry(overrides = {}) {
  return {
    id: 'e1',
    title: 'CSAPP — lab-first',
    url: null,
    topic_id: 't1',
    topics: { name: 'Systems', master_doc: '## Active: CSAPP\nNext: Cache Lab — implement the LRU sim\n' },
    ...overrides,
  }
}

test('parseNext extracts the next-action line case-insensitively', () => {
  expect(parseNext('## Active\nnext:  do the thing\n')).toBe('do the thing')
  expect(parseNext('no pointer here')).toBeNull()
  expect(parseNext('')).toBeNull()
})

test('shows the active resource and its next action', async () => {
  render(<FocusWidget supabase={mockSupabase([makeEntry()])} onOpenEntry={vi.fn()} />)
  expect(await screen.findByText('CSAPP — lab-first')).toBeInTheDocument()
  expect(screen.getByText(/Cache Lab — implement the LRU sim/)).toBeInTheDocument()
  expect(screen.getByText('Systems')).toBeInTheDocument()
})

test('empty state when nothing is active', async () => {
  render(<FocusWidget supabase={mockSupabase([])} onOpenEntry={vi.fn()} />)
  expect(await screen.findByText(/Nothing active/)).toBeInTheDocument()
})

test('prompts to add a Next line when the doc has none', async () => {
  const entry = makeEntry({ topics: { name: 'Systems', master_doc: '## Active: CSAPP' } })
  render(<FocusWidget supabase={mockSupabase([entry])} onOpenEntry={vi.fn()} />)
  expect(await screen.findByText(/add a “Next:” line/)).toBeInTheDocument()
})

test('clicking the card opens the entry in its topic', async () => {
  const onOpenEntry = vi.fn()
  render(<FocusWidget supabase={mockSupabase([makeEntry()])} onOpenEntry={onOpenEntry} />)
  await screen.findByText('CSAPP — lab-first')
  await userEvent.click(screen.getByRole('button'))
  expect(onOpenEntry).toHaveBeenCalledWith({ id: 'e1', topic_id: 't1' })
})

test('falls back to the empty state when the query fails', async () => {
  // Previously indistinguishable from success: the widget read `data` only, so
  // a failed request rendered "Nothing active" with no way to tell. The db
  // layer now throws; this is the widget deciding, deliberately, that a home
  // widget stays quiet about it.
  getFocusEntry.mockRejectedValue(new Error('down'))
  render(<FocusWidget supabase={{}} onOpenEntry={vi.fn()} />)
  expect(await screen.findByText(/Nothing active/)).toBeInTheDocument()
})
