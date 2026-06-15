import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './EntryCard.jsx'

vi.mock('./NoteEditor.jsx', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="note editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my **takeaway**', status: null, tags: [], pinned: false }
const noop = () => {}
const handlers = {
  onDelete: noop, onStatusChange: noop, onTagsChange: noop, onTogglePin: noop,
  onNoteSave: noop, onNoteVersion: noop, onShowHistory: noop,
}

test('renders markdown note and links open in a new tab', () => {
  render(<EntryCard entry={base} {...handlers} />)
  expect(screen.getByRole('link', { name: 'A Site' })).toHaveAttribute('target', '_blank')
})

test('shows a live preview while editing', async () => {
  render(<EntryCard entry={base} {...handlers} />)
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.clear(editor)
  await userEvent.type(editor, '# Heading now')
  expect(screen.getByRole('heading', { name: 'Heading now' })).toBeInTheDocument()
})

test('commits a version on Done', async () => {
  const onNoteSave = vi.fn()
  const onNoteVersion = vi.fn()
  render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} onNoteVersion={onNoteVersion} />)
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.clear(editor)
  await userEvent.type(editor, 'committed text')
  await userEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(onNoteSave).toHaveBeenCalledWith('x', 'committed text')
  expect(onNoteVersion).toHaveBeenCalledWith('x', 'committed text')
})

test('requests history', async () => {
  const onShowHistory = vi.fn()
  render(<EntryCard entry={base} {...handlers} onShowHistory={onShowHistory} />)
  await userEvent.click(screen.getByRole('button', { name: /history/i }))
  expect(onShowHistory).toHaveBeenCalledWith('x')
})

test('toggles pin, status, delete, tags', async () => {
  const onTogglePin = vi.fn(); const onStatusChange = vi.fn(); const onDelete = vi.fn(); const onTagsChange = vi.fn()
  render(<EntryCard entry={base} {...handlers} onTogglePin={onTogglePin} onStatusChange={onStatusChange} onDelete={onDelete} onTagsChange={onTagsChange} />)
  await userEvent.click(screen.getByRole('button', { name: /pin/i }))
  expect(onTogglePin).toHaveBeenCalledWith('x', true)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
  await userEvent.type(screen.getByPlaceholderText(/add tag/i), 'book{Enter}')
  expect(onTagsChange).toHaveBeenCalledWith('x', ['book'])
})
