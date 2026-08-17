import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import Revisit from '../../../src/components/Revisit.jsx'

const entries = [
  { id: 'a', url: 'http://a.com', title: 'A', note: 'note a', tags: [] },
  { id: 'b', url: null, title: null, note: 'note b', tags: [] },
]

test('shows the first entry and advances on rating', async () => {
  const onSeen = vi.fn(() => Promise.resolve())
  const onRate = vi.fn(() => Promise.resolve())
  render(<Revisit entries={entries} onSeen={onSeen} onRate={onRate} />)
  expect(screen.getByText('note a')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /good/i }))
  expect(onRate).toHaveBeenCalledWith(entries[0], 4)
  expect(screen.getByText('note b')).toBeInTheDocument()
})

test('shows empty message when nothing to revisit', () => {
  render(<Revisit entries={[]} onSeen={() => {}} />)
  expect(screen.getByText(/nothing to resurface/i)).toBeInTheDocument()
})

test('retiring ends the loop for that entry and advances', async () => {
  const onRetire = vi.fn(() => Promise.resolve())
  render(<Revisit entries={entries} onSeen={() => {}} onRate={vi.fn()} onRetire={onRetire} />)
  await userEvent.click(screen.getByRole('button', { name: /done with it/i }))
  expect(onRetire).toHaveBeenCalledWith(entries[0])
  expect(screen.getByText('note b')).toBeInTheDocument()
})

test('the retire button is absent when no handler is wired', () => {
  render(<Revisit entries={entries} onSeen={() => {}} onRate={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /done with it/i })).not.toBeInTheDocument()
})
