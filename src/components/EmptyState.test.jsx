import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EmptyState from './EmptyState.jsx'

test('renders message', () => {
  render(<EmptyState message="Nothing here yet." />)
  expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
})

test('renders action button when provided', () => {
  const onClick = vi.fn()
  render(<EmptyState message="Empty." action={{ label: 'Add one', onClick }} />)
  expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument()
})

test('calls action onClick', async () => {
  const onClick = vi.fn()
  render(<EmptyState message="Empty." action={{ label: 'Go', onClick }} />)
  await userEvent.click(screen.getByRole('button', { name: 'Go' }))
  expect(onClick).toHaveBeenCalledOnce()
})

test('does not render button when action is absent', () => {
  render(<EmptyState message="Empty." />)
  expect(screen.queryByRole('button')).toBeNull()
})
