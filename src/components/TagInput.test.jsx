import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import TagInput from './TagInput.jsx'

test('adds a tag on Enter and calls onChange', async () => {
  const onChange = vi.fn()
  render(<TagInput value={[]} onChange={onChange} />)
  await userEvent.type(screen.getByPlaceholderText(/tag/i), 'book{Enter}')
  expect(onChange).toHaveBeenCalledWith(['book'])
})

test('removes a tag when its chip is clicked', async () => {
  const onChange = vi.fn()
  render(<TagInput value={['book', 'ai']} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: /remove book/i }))
  expect(onChange).toHaveBeenCalledWith(['ai'])
})
