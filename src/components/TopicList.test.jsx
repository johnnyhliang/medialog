import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import TopicList from './TopicList.jsx'

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
