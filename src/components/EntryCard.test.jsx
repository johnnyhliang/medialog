import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './EntryCard.jsx'

test('renders title as link and note, fires delete', async () => {
  const onDelete = vi.fn()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my takeaway' }
  render(<EntryCard entry={entry} onDelete={onDelete} />)
  const link = screen.getByRole('link', { name: 'A Site' })
  expect(link).toHaveAttribute('href', 'http://a.com')
  expect(screen.getByText('my takeaway')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})

test('falls back to raw url when no title', () => {
  const entry = { id: 'y', url: 'http://b.com', title: null, note: '' }
  render(<EntryCard entry={entry} onDelete={() => {}} />)
  expect(screen.getByRole('link', { name: 'http://b.com' })).toBeInTheDocument()
})
