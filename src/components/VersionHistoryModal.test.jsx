import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import VersionHistoryModal from './VersionHistoryModal.jsx'

test('renders version history label', () => {
  render(
    <VersionHistoryModal
      versions={[]}
      onRestore={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText('Version history')).toBeTruthy()
})

test('Close button calls onClose', () => {
  const onClose = vi.fn()
  render(
    <VersionHistoryModal
      versions={[]}
      onRestore={vi.fn()}
      onClose={onClose}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /close/i }))
  expect(onClose).toHaveBeenCalledOnce()
})
