// src/components/InboxCard.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import InboxCard from './InboxCard.jsx'

test('shows count and Sort now button when count > 0', () => {
  render(<InboxCard count={3} onSortInbox={vi.fn()} />)
  expect(screen.getByText(/3/)).toBeTruthy()
  expect(screen.getByRole('button', { name: /sort now/i })).toBeTruthy()
})

test('calls onSortInbox when Sort now clicked', async () => {
  const onSortInbox = vi.fn()
  render(<InboxCard count={5} onSortInbox={onSortInbox} />)
  await userEvent.click(screen.getByRole('button', { name: /sort now/i }))
  expect(onSortInbox).toHaveBeenCalledOnce()
})

test('shows all clear state when count is 0', () => {
  render(<InboxCard count={0} onSortInbox={vi.fn()} />)
  expect(screen.getByText(/all clear/i)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /sort now/i })).toBeNull()
})
