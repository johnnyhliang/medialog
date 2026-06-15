import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import ProgressView from './ProgressView.jsx'

const entries = [
  { id: '1', status: 'done', tags: ['book'] },
  { id: '2', status: 'done', tags: ['video'] },
  { id: '3', status: 'active', tags: [] },
  { id: '4', status: null, tags: [] },
]

test('shows counts per status', () => {
  render(<ProgressView topicName="AI" entries={entries} />)
  expect(screen.getByText(/Done: 2/)).toBeInTheDocument()
  expect(screen.getByText(/Active: 1/)).toBeInTheDocument()
  expect(screen.getByText(/Backlog: 0/)).toBeInTheDocument()
})

test('shows the topic name', () => {
  render(<ProgressView topicName="AI" entries={entries} />)
  expect(screen.getByText(/AI/)).toBeInTheDocument()
})
