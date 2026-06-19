import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import StorageBar from './StorageBar.jsx'

const MB = 1024 * 1024
const CAP = 500 * MB

test('shows used and cap in MB', () => {
  render(<StorageBar totalBytes={210 * MB} capBytes={CAP} />)
  expect(screen.getByText(/210\.0 MB of 500 MB/i)).toBeInTheDocument()
})

test('does not show warning below 80%', () => {
  render(<StorageBar totalBytes={300 * MB} capBytes={CAP} />)
  expect(screen.queryByText(/approaching limit/i)).not.toBeInTheDocument()
})

test('shows warning at exactly 80%', () => {
  render(<StorageBar totalBytes={400 * MB} capBytes={CAP} />)
  expect(screen.getByText(/approaching limit/i)).toBeInTheDocument()
})

test('shows warning above 80%', () => {
  render(<StorageBar totalBytes={450 * MB} capBytes={CAP} />)
  expect(screen.getByText(/approaching limit/i)).toBeInTheDocument()
})

test('fill bar has warn class above 80%', () => {
  const { container } = render(<StorageBar totalBytes={400 * MB} capBytes={CAP} />)
  expect(container.querySelector('.storage-bar-fill.storage-bar-warn')).not.toBeNull()
})

test('fill bar has no warn class below 80%', () => {
  const { container } = render(<StorageBar totalBytes={300 * MB} capBytes={CAP} />)
  expect(container.querySelector('.storage-bar-fill.storage-bar-warn')).toBeNull()
})
