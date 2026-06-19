// src/components/TopicsGrid.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import TopicsGrid from './TopicsGrid.jsx'

const topics = [
  { id: '1', name: 'AI' },
  { id: '2', name: 'Books' },
  { id: '3', name: 'Work' },
]

test('renders all topic cards alphabetically', () => {
  render(<TopicsGrid topics={topics} onSelectTopic={vi.fn()} />)
  const buttons = screen.getAllByRole('button')
  expect(buttons.map((b) => b.textContent)).toEqual(
    expect.arrayContaining(['AI', 'Books', 'Work'])
  )
})

test('calls onSelectTopic with the clicked topic object', async () => {
  const onSelectTopic = vi.fn()
  render(<TopicsGrid topics={topics} onSelectTopic={onSelectTopic} />)
  await userEvent.click(screen.getByText('Books'))
  expect(onSelectTopic).toHaveBeenCalledWith(topics[1])
})

test('shows empty state when no topics', () => {
  render(<TopicsGrid topics={[]} onSelectTopic={vi.fn()} />)
  expect(screen.getByText(/no topics yet/i)).toBeTruthy()
})
