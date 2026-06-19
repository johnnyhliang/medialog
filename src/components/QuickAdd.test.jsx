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

test('shows duplicate warning after URL field blurs when duplicate found', async () => {
  const onCheckDuplicate = vi.fn(() =>
    Promise.resolve({ id: 'y', created_at: '2026-06-01T00:00:00Z', topic_name: 'AI' })
  )
  render(<QuickAdd onAdd={vi.fn()} disabled={false} onCheckDuplicate={onCheckDuplicate} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.tab()
  expect(await screen.findByText(/you saved this/i)).toBeInTheDocument()
  expect(screen.getByText('AI')).toBeInTheDocument()
})

test('does not show duplicate warning when no duplicate found', async () => {
  const onCheckDuplicate = vi.fn(() => Promise.resolve(null))
  render(<QuickAdd onAdd={vi.fn()} disabled={false} onCheckDuplicate={onCheckDuplicate} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.tab()
  await new Promise(r => setTimeout(r, 50))
  expect(screen.queryByText(/you saved this/i)).not.toBeInTheDocument()
})

test('duplicate warning dismisses on clicking Dismiss', async () => {
  const onCheckDuplicate = vi.fn(() =>
    Promise.resolve({ id: 'y', created_at: '2026-06-01T00:00:00Z', topic_name: 'AI' })
  )
  render(<QuickAdd onAdd={vi.fn()} disabled={false} onCheckDuplicate={onCheckDuplicate} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.tab()
  await screen.findByText(/you saved this/i)
  await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
  expect(screen.queryByText(/you saved this/i)).not.toBeInTheDocument()
})

test('shows soft nudge after saving with URL but no note', async () => {
  const onAdd = vi.fn(() => Promise.resolve())
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(screen.getByText(/no notes yet/i)).toBeInTheDocument()
})

test('nudge clears when user types in note field', async () => {
  const onAdd = vi.fn(() => Promise.resolve())
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(screen.getByText(/no notes yet/i)).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText(/worth remembering/i), 'a')
  expect(screen.queryByText(/no notes yet/i)).not.toBeInTheDocument()
})

test('does not show nudge when note is present on save', async () => {
  const onAdd = vi.fn(() => Promise.resolve())
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.type(screen.getByPlaceholderText(/worth remembering/i), 'my note')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(screen.queryByText(/no notes yet/i)).not.toBeInTheDocument()
})
