import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import BulkImport from './BulkImport.jsx'

test('parses textarea and calls onImport with item count', async () => {
  const onImport = vi.fn(() => Promise.resolve(2))
  render(<BulkImport onImport={onImport} />)
  await userEvent.type(screen.getByPlaceholderText(/paste/i), 'https://a.com\nan idea')
  await userEvent.click(screen.getByRole('button', { name: /import to inbox/i }))
  expect(onImport).toHaveBeenCalledWith([
    { url: 'https://a.com', note: '' },
    { url: null, note: 'an idea' },
  ])
})

test('does nothing on empty input', async () => {
  const onImport = vi.fn()
  render(<BulkImport onImport={onImport} />)
  await userEvent.click(screen.getByRole('button', { name: /import to inbox/i }))
  expect(onImport).not.toHaveBeenCalled()
})
