import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryList from './EntryList.jsx'

vi.mock('./EntryCard.jsx', () => ({
  default: ({ entry }) => <div data-testid="entry-card">{entry.id}</div>,
}))

const noop = () => {}
const handlers = { onDelete: noop, onStatusChange: noop, onTagsChange: noop, onTogglePin: noop, onNoteSave: noop }

function makeEntries(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `e${i}`, title: `Entry ${i}`, tags: [] }))
}

test('renders empty state when no entries', () => {
  render(<EntryList entries={[]} {...handlers} />)
  expect(screen.getByText(/no entries/i)).toBeInTheDocument()
})

test('renders all entries when under PAGE_SIZE', () => {
  render(<EntryList entries={makeEntries(10)} {...handlers} />)
  expect(screen.getAllByTestId('entry-card')).toHaveLength(10)
})

test('renders only PAGE_SIZE entries initially when list is large', () => {
  render(<EntryList entries={makeEntries(80)} {...handlers} />)
  expect(screen.getAllByTestId('entry-card')).toHaveLength(50)
  expect(screen.getByRole('button', { name: /show 30 more/i })).toBeInTheDocument()
})

test('loads more when Show more is clicked', async () => {
  render(<EntryList entries={makeEntries(80)} {...handlers} />)
  await userEvent.click(screen.getByRole('button', { name: /show 30 more/i }))
  expect(screen.getAllByTestId('entry-card')).toHaveLength(80)
})
