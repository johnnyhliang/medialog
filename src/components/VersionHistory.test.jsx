import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import VersionHistory from './VersionHistory.jsx'

const versions = [
  { id: 'v2', note: 'second draft', created_at: '2026-06-14T10:00:00Z' },
  { id: 'v1', note: 'first draft', created_at: '2026-06-13T10:00:00Z' },
]

test('lists versions with a preview', () => {
  render(<VersionHistory versions={versions} onRestore={() => {}} />)
  expect(screen.getByText(/second draft/)).toBeInTheDocument()
  expect(screen.getByText(/first draft/)).toBeInTheDocument()
})

test('restores a chosen version', async () => {
  const onRestore = vi.fn()
  render(<VersionHistory versions={versions} onRestore={onRestore} />)
  await userEvent.click(screen.getAllByRole('button', { name: /restore/i })[1])
  expect(onRestore).toHaveBeenCalledWith('first draft')
})

test('shows empty state', () => {
  render(<VersionHistory versions={[]} onRestore={() => {}} />)
  expect(screen.getByText(/no past versions/i)).toBeInTheDocument()
})
