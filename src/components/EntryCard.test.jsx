import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './EntryCard.jsx'

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my **takeaway**', status: null, tags: [] }
const noop = () => {}

test('renders title link and markdown note', () => {
  render(<EntryCard entry={base} onDelete={noop} onStatusChange={noop} onTagsChange={noop} />)
  expect(screen.getByRole('link', { name: 'A Site' })).toHaveAttribute('href', 'http://a.com')
  expect(screen.getByText('takeaway').tagName).toBe('STRONG')
})

test('falls back to raw url when no title', () => {
  render(<EntryCard entry={{ ...base, title: null }} onDelete={noop} onStatusChange={noop} onTagsChange={noop} />)
  expect(screen.getByRole('link', { name: 'http://a.com' })).toBeInTheDocument()
})

test('shows tag chips as removable buttons', () => {
  render(<EntryCard entry={{ ...base, tags: ['book', 'ai'] }} onDelete={noop} onStatusChange={noop} onTagsChange={noop} />)
  expect(screen.getByRole('button', { name: /remove book/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /remove ai/i })).toBeInTheDocument()
})

test('changes status via selector', async () => {
  const onStatusChange = vi.fn()
  render(<EntryCard entry={base} onDelete={noop} onStatusChange={onStatusChange} onTagsChange={noop} />)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})

test('edits tags through TagInput', async () => {
  const onTagsChange = vi.fn()
  render(<EntryCard entry={{ ...base, tags: [] }} onDelete={noop} onStatusChange={noop} onTagsChange={onTagsChange} />)
  await userEvent.type(screen.getByPlaceholderText(/add tag/i), 'book{Enter}')
  expect(onTagsChange).toHaveBeenCalledWith('x', ['book'])
})

test('fires delete', async () => {
  const onDelete = vi.fn()
  render(<EntryCard entry={base} onDelete={onDelete} onStatusChange={noop} onTagsChange={noop} />)
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})
