import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { test, expect, vi } from 'vitest'
import TopicView from './TopicView.jsx'

vi.mock('./TopicDocEditor.jsx', () => ({ default: () => <div>doc editor</div> }))

const topic = { id: 't1', name: 'My Topic', master_doc: '' }
const entries = [
  { id: 'e1', title: 'Alpha note', note: 'alpha', url: null, tags: [], created_at: new Date().toISOString() },
  { id: 'e2', title: 'Beta note', note: 'beta', url: null, tags: [], created_at: new Date().toISOString() },
]
const noop = () => {}
const props = {
  topic, entries, allCandidates: [],
  onAddEntry: noop, onDelete: noop, onStatusChange: noop,
  onTagsChange: noop, onTogglePin: noop, onNoteSave: noop,
  onPreview: noop, onDocChange: noop,
}

test('scoped search filters the entry list', async () => {
  render(<TopicView {...props} />)
  expect(screen.getByText('Alpha note')).toBeInTheDocument()
  expect(screen.getByText('Beta note')).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText(/search/i), 'alpha')
  expect(screen.getByText('Alpha note')).toBeInTheDocument()
  expect(screen.queryByText('Beta note')).not.toBeInTheDocument()
})

test('view toggle shows/hides the master doc editor', async () => {
  render(<TopicView {...props} />)
  // default for a topic with empty doc is List → no editor
  expect(screen.queryByText('doc editor')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^doc$/i }))
  expect(screen.getByText('doc editor')).toBeInTheDocument()
})
