// src/components/HomeView.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import HomeView from './HomeView.jsx'

vi.mock('./WidgetPanel.jsx', () => ({ default: () => <div data-testid="widget-panel" /> }))

const mockSupabase = {
  functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('skip') }) },
}

const topics = [
  { id: 'inbox', name: 'Inbox' },
  { id: '1', name: 'AI' },
  { id: '2', name: 'Books' },
]

test('renders inbox card and topics grid (excludes Inbox topic)', () => {
  render(
    <HomeView
      topics={topics}
      inboxCount={3}
      onSelectTopic={vi.fn()}
      onSortInbox={vi.fn()}
      supabase={mockSupabase}
    />
  )
  expect(screen.getByText(/3/)).toBeTruthy()          // inbox count
  expect(screen.getByText('AI')).toBeTruthy()          // topic card
  expect(screen.getByText('Books')).toBeTruthy()
  // 'Inbox' appears in InboxCard label, but not in topics grid
  const buttons = screen.getAllByRole('button')
  const topicGridBtns = buttons.filter((b) => ['AI', 'Books'].includes(b.textContent))
  expect(topicGridBtns).toHaveLength(2)
})

test('onSortInbox is called when Sort now is clicked', async () => {
  const onSortInbox = vi.fn()
  render(
    <HomeView
      topics={topics}
      inboxCount={2}
      onSelectTopic={vi.fn()}
      onSortInbox={onSortInbox}
      supabase={mockSupabase}
    />
  )
  await userEvent.click(screen.getByRole('button', { name: /sort now/i }))
  expect(onSortInbox).toHaveBeenCalledOnce()
})

test('onSelectTopic is called with the clicked topic', async () => {
  const onSelectTopic = vi.fn()
  render(
    <HomeView
      topics={topics}
      inboxCount={0}
      onSelectTopic={onSelectTopic}
      onSortInbox={vi.fn()}
      supabase={mockSupabase}
    />
  )
  await userEvent.click(screen.getByText('AI'))
  expect(onSelectTopic).toHaveBeenCalledWith(topics[1])
})
