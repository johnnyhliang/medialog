import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { test, expect, vi } from 'vitest'
import ReturnButton from './ReturnButton.jsx'

test('renders and fires onReturn', async () => {
  const onReturn = vi.fn()
  render(<ReturnButton onReturn={onReturn} />)
  await userEvent.click(screen.getByRole('button', { name: /return/i }))
  expect(onReturn).toHaveBeenCalled()
})
