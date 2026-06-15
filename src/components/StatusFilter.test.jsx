import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import StatusFilter from './StatusFilter.jsx'

test('renders all filter options', () => {
  render(<StatusFilter value="" onChange={() => {}} />)
  expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument()
})

test('fires onChange with the chosen status', async () => {
  const onChange = vi.fn()
  render(<StatusFilter value="" onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Active' }))
  expect(onChange).toHaveBeenCalledWith('active')
})

test('marks the current value active', () => {
  render(<StatusFilter value="done" onChange={() => {}} />)
  expect(screen.getByRole('button', { name: 'Done' })).toHaveClass('active')
})
