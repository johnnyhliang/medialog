import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import TopicTOC from './TopicTOC.jsx'

const entries = [
  { id: 'e1', note: '# Linear Algebra\nrow reduction' },
  { id: 'e2', note: 'plain note, no heading' },
  { id: 'e3', note: '# Eigenvalues' },
]

test('lists only entries with an H1 heading, linking to their anchors', () => {
  render(<TopicTOC entries={entries} />)
  const la = screen.getByRole('link', { name: 'Linear Algebra' })
  expect(la).toHaveAttribute('href', '#entry-e1')
  expect(screen.getByRole('link', { name: 'Eigenvalues' })).toHaveAttribute('href', '#entry-e3')
  expect(screen.queryByText('plain note, no heading')).not.toBeInTheDocument()
})

test('renders nothing when no entry has a heading', () => {
  const { container } = render(<TopicTOC entries={[{ id: 'x', note: 'no heading' }]} />)
  expect(container).toBeEmptyDOMElement()
})
