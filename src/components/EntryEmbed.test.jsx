import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { test, expect, vi } from 'vitest'
import EntryEmbed from './EntryEmbed.jsx'

const entry = { id: 'e1', title: 'My Entry', url: 'https://example.com', note: 'some note text' }
const getEntry = (id) => (id === 'e1' ? entry : null)

test('renders chip with label and fires onJump on click', async () => {
  const onJump = vi.fn()
  render(<EntryEmbed entryId="e1" label="My Entry" getEntry={getEntry} onJump={onJump} />)
  const chip = screen.getByRole('button', { name: /my entry/i })
  await userEvent.click(chip)
  expect(onJump).toHaveBeenCalledWith('e1')
})

test('shows popover with note text on hover', async () => {
  render(<EntryEmbed entryId="e1" label="My Entry" getEntry={getEntry} onJump={() => {}} />)
  await userEvent.hover(screen.getByRole('button', { name: /my entry/i }))
  expect(await screen.findByText(/some note text/i)).toBeInTheDocument()
})

test('missing entry renders greyed chip and does not jump', async () => {
  const onJump = vi.fn()
  render(<EntryEmbed entryId="gone" label="x" getEntry={getEntry} onJump={onJump} />)
  const chip = screen.getByText(/missing entry/i)
  await userEvent.click(chip)
  expect(onJump).not.toHaveBeenCalled()
})
