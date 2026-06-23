import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import FocusWidget, { parseNext } from './FocusWidget.jsx'

function mockSupabase(rows = []) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  }
  return { from: vi.fn(() => chain) }
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
