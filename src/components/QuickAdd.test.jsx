import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import QuickAdd from './QuickAdd.jsx'

test('submits url + note and clears fields', async () => {
  const onAdd = vi.fn(() => Promise.resolve())
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.type(screen.getByPlaceholderText(/worth remembering/i), 'thought')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onAdd).toHaveBeenCalledWith({ url: 'http://x.com', note: 'thought' })
})

test('does not submit when both fields empty', async () => {
  const onAdd = vi.fn()
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onAdd).not.toHaveBeenCalled()
})
