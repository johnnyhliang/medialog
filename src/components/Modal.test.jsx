import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import Modal from './Modal.jsx'

test('renders children', () => {
  render(<Modal onClose={() => {}} label="Test modal"><p>hello</p></Modal>)
  expect(screen.getByText('hello')).toBeInTheDocument()
})

test('calls onClose when Escape is pressed', async () => {
  const onClose = vi.fn()
  render(<Modal onClose={onClose} label="Test modal"><p>content</p></Modal>)
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledOnce()
})

test('calls onClose when backdrop is clicked', async () => {
  const onClose = vi.fn()
  const { container } = render(<Modal onClose={onClose} label="Test modal"><p>content</p></Modal>)
  const backdrop = container.querySelector('.modal-backdrop')
  await userEvent.click(backdrop)
  expect(onClose).toHaveBeenCalledOnce()
})

test('does NOT call onClose when dialog panel is clicked', async () => {
  const onClose = vi.fn()
  render(<Modal onClose={onClose} label="Test modal"><p>content</p></Modal>)
  await userEvent.click(screen.getByRole('dialog'))
  expect(onClose).not.toHaveBeenCalled()
})
