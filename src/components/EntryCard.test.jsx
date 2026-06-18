import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './EntryCard.jsx'

// Mock the CodeMirror wrapper with a plain textarea.
vi.mock('./NoteEditor.jsx', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="note editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my **takeaway**', status: null, tags: [], pinned: false }
const noop = () => {}
const handlers = { onDelete: noop, onStatusChange: noop, onTagsChange: noop, onTogglePin: noop, onNoteSave: noop }

test('renders markdown note and links open in a new tab', () => {
  render(<EntryCard entry={base} {...handlers} />)
  const link = screen.getByRole('link', { name: 'A Site' })
  expect(link).toHaveAttribute('target', '_blank')
})

test('has an anchor id for the table of contents', () => {
  const { container } = render(<EntryCard entry={base} {...handlers} />)
  expect(container.querySelector('#entry-x')).not.toBeNull()
})

test('toggles pin', async () => {
  const onTogglePin = vi.fn()
  render(<EntryCard entry={base} {...handlers} onTogglePin={onTogglePin} />)
  await userEvent.click(screen.getByRole('button', { name: /pin/i }))
  expect(onTogglePin).toHaveBeenCalledWith('x', true)
})

test('edits the note and saves on Done', async () => {
  const onNoteSave = vi.fn()
  render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.clear(editor)
  await userEvent.type(editor, 'updated note')
  await userEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(onNoteSave).toHaveBeenCalledWith('x', 'updated note')
})

test('changes status', async () => {
  const onStatusChange = vi.fn()
  render(<EntryCard entry={base} {...handlers} onStatusChange={onStatusChange} />)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})

test('delete asks for confirmation, then fires onDelete', async () => {
  const onDelete = vi.fn()
  render(<EntryCard entry={base} {...handlers} onDelete={onDelete} />)
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  // confirm modal — onDelete not called until confirmed
  expect(onDelete).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /move to trash/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})

test('edits tags through TagInput', async () => {
  const onTagsChange = vi.fn()
  render(<EntryCard entry={{ ...base, tags: [] }} {...handlers} onTagsChange={onTagsChange} />)
  await userEvent.type(screen.getByPlaceholderText(/add tag/i), 'book{Enter}')
  expect(onTagsChange).toHaveBeenCalledWith('x', ['book'])
})

test('preview button shows filename from URL', () => {
  const entry = { ...base, url: 'https://storage.example.com/user/abc-report.pdf', title: 'Report' }
  // classifyUrl needs to return non-null so the preview button renders
  render(<EntryCard entry={entry} {...handlers} onPreview={() => {}} />)
  expect(screen.getByRole('button', { name: /report\.pdf/i })).toBeInTheDocument()
})
