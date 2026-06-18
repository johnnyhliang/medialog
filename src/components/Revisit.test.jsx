import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import Revisit from './Revisit.jsx'

const entries = [
  { id: 'a', url: 'http://a.com', title: 'A', note: 'note a', tags: [] },
  { id: 'b', url: null, title: null, note: 'note b', tags: [] },
]

test('shows the first entry and advances on "seen"', async () => {
  const onSeen = vi.fn(() => Promise.resolve())
  render(<Revisit entries={entries} onSeen={onSeen} />)
  expect(screen.getByText('note a')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /seen/i }))
  expect(onSeen).toHaveBeenCalledWith('a')
  expect(screen.getByText('note b')).toBeInTheDocument()
})

test('shows empty message when nothing to revisit', () => {
  render(<Revisit entries={[]} onSeen={() => {}} />)
  expect(screen.getByText(/nothing to resurface/i)).toBeInTheDocument()
})
