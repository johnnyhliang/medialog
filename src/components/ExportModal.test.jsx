import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import ExportModal from './ExportModal.jsx'

const TOPICS = [{ id: '1', name: 'Books' }, { id: '2', name: 'Films' }]

test('shows loading message when loading is true', () => {
  render(
    <ExportModal
      exportModal={{ estimatedKB: null, entryCount: null, loading: true }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText(/calculating export size/i)).toBeTruthy()
})

test('shows entry count and topic count when loaded', () => {
  render(
    <ExportModal
      exportModal={{ estimatedKB: 50, entryCount: 42, loading: false }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText(/42 entries/i)).toBeTruthy()
  expect(screen.getByText(/2 topics/i)).toBeTruthy()
})

test('shows size in KB when under 1024', () => {
  render(
    <ExportModal
      exportModal={{ estimatedKB: 50, entryCount: 10, loading: false }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText(/50 KB/)).toBeTruthy()
})

test('shows size in MB when 1024 or more', () => {
  render(
    <ExportModal
      exportModal={{ estimatedKB: 2048, entryCount: 10, loading: false }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />
  )
  expect(screen.getByText(/2\.0 MB/)).toBeTruthy()
})

test('Export button calls onConfirm', () => {
  const onConfirm = vi.fn()
  render(
    <ExportModal
      exportModal={{ estimatedKB: 10, entryCount: 5, loading: false }}
      topics={TOPICS}
      onConfirm={onConfirm}
      onClose={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /^export$/i }))
  expect(onConfirm).toHaveBeenCalledOnce()
})

test('Cancel button calls onClose', () => {
  const onClose = vi.fn()
  render(
    <ExportModal
      exportModal={{ estimatedKB: 10, entryCount: 5, loading: false }}
      topics={TOPICS}
      onConfirm={vi.fn()}
      onClose={onClose}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(onClose).toHaveBeenCalledOnce()
})
