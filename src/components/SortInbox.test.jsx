import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import SortInbox from './SortInbox.jsx'

const topics = [
  { id: 'inbox', name: 'Inbox' },
  { id: 'ai', name: 'AI' },
  { id: 'film', name: 'Film' },
]
const inboxEntries = [
  { id: 'e1', url: 'http://a.com', title: 'A', note: '' },
  { id: 'e2', url: null, title: null, note: 'idea two' },
]

test('shows the first inbox entry and a topic selector excluding Inbox', () => {
  render(<SortInbox entries={inboxEntries} topics={topics} onAssign={() => {}} onDelete={() => {}} />)
  expect(screen.getByText('A')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'AI' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Inbox' })).not.toBeInTheDocument()
})

test('assigns the current entry to the chosen topic', async () => {
  const onAssign = vi.fn(() => Promise.resolve())
  render(<SortInbox entries={inboxEntries} topics={topics} onAssign={onAssign} onDelete={() => {}} />)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'ai')
  await userEvent.click(screen.getByRole('button', { name: /assign/i }))
  expect(onAssign).toHaveBeenCalledWith('e1', 'ai')
})

test('deletes the current entry', async () => {
  const onDelete = vi.fn(() => Promise.resolve())
  render(<SortInbox entries={inboxEntries} topics={topics} onAssign={() => {}} onDelete={onDelete} />)
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('e1')
})

test('shows done message when no entries', () => {
  render(<SortInbox entries={[]} topics={topics} onAssign={() => {}} onDelete={() => {}} />)
  expect(screen.getByText(/inbox is clear/i)).toBeInTheDocument()
})
