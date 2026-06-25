import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import TopicList from './TopicList.jsx'

beforeEach(() => localStorage.clear())

test('lists topics and selects one on click', async () => {
  const onSelect = vi.fn()
  const topics = [{ id: '1', name: 'AI' }, { id: '2', name: 'Film' }]
  render(<TopicList topics={topics} selectedId="1" onSelect={onSelect} onAdd={() => {}} />)
  await userEvent.click(screen.getByText('Film'))
  expect(onSelect).toHaveBeenCalledWith('2')
})

test('adds a new topic', async () => {
  const onAdd = vi.fn()
  render(<TopicList topics={[]} selectedId={null} onSelect={() => {}} onAdd={onAdd} />)
  await userEvent.type(screen.getByPlaceholderText(/new topic/i), 'Fitness')
  await userEvent.click(screen.getByRole('button', { name: /add/i }))
  expect(onAdd).toHaveBeenCalledWith('Fitness')
})

test('renders Inbox topic first with inbox icon', () => {
  const topics = [
    { id: 'i', name: 'Inbox' },
    { id: '1', name: 'Zebra' },
    { id: '2', name: 'Alpha' },
  ]
  render(<TopicList topics={topics} selectedId={null} onSelect={() => {}} onAdd={() => {}} />)
  const inboxBtn = document.querySelector('.topic-inbox-btn')
  expect(inboxBtn).toBeTruthy()
  const topicBtns = [...document.querySelectorAll('.topic-row-btn')]
  const names = topicBtns.map((b) => b.textContent.trim()).sort()
  expect(names).toEqual(['Alpha', 'Zebra'])
})

const baseProps = {
  topics: [{ id: 'i', name: 'Inbox', archived_at: null }],
  activeTopics: [{ id: 'i', name: 'Inbox', archived_at: null }, { id: 'a1', name: 'AI', archived_at: null }],
  archivedTopics: [{ id: 'a2', name: 'Old Project', archived_at: '2026-01-01' }],
  selectedId: null,
  onSelect: vi.fn(),
  onAdd: vi.fn(),
  sidebarCollapsed: false,
}

test('archived section is collapsed by default and expands on click', async () => {
  render(<TopicList {...baseProps} />)
  expect(screen.queryByText('Old Project')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /archived/i }))
  expect(screen.getByText('Old Project')).toBeInTheDocument()
})
