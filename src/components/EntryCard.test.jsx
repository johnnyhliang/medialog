import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './EntryCard.jsx'

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my **takeaway**', status: null, tags: [] }

test('renders title link and markdown note', () => {
  render(<EntryCard entry={base} onDelete={() => {}} onStatusChange={() => {}} />)
  expect(screen.getByRole('link', { name: 'A Site' })).toHaveAttribute('href', 'http://a.com')
  expect(screen.getByText('takeaway').tagName).toBe('STRONG')
})

test('falls back to raw url when no title', () => {
  render(<EntryCard entry={{ ...base, title: null }} onDelete={() => {}} onStatusChange={() => {}} />)
  expect(screen.getByRole('link', { name: 'http://a.com' })).toBeInTheDocument()
})

test('shows tag chips', () => {
  render(<EntryCard entry={{ ...base, tags: ['book', 'ai'] }} onDelete={() => {}} onStatusChange={() => {}} />)
  expect(screen.getByText('#book')).toBeInTheDocument()
  expect(screen.getByText('#ai')).toBeInTheDocument()
})

test('changes status via selector', async () => {
  const onStatusChange = vi.fn()
  render(<EntryCard entry={base} onDelete={() => {}} onStatusChange={onStatusChange} />)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})

test('fires delete', async () => {
  const onDelete = vi.fn()
  render(<EntryCard entry={base} onDelete={onDelete} onStatusChange={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})
