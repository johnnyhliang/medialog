import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from '../../../src/components/EntryCard.jsx'
import { snoozeEntry } from '../../../src/lib/db/entries.js'

vi.mock('../../../src/lib/db/entries.js', () => ({
  snoozeEntry: vi.fn(() => Promise.resolve()),
  unsnoozeEntry: vi.fn(() => Promise.resolve()),
}))

// Mock the CodeMirror wrapper with a plain textarea.
vi.mock('../../../src/components/NoteEditor.jsx', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="note editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my **takeaway**', status: null, tags: [], pinned: false }
const noop = () => {}
const handlers = { onDelete: noop, onStatusChange: noop, onTagsChange: noop, onTogglePin: noop, onNoteSave: noop }

async function expandCard(container) {
  // Click the card body (not a link/button) to expand inline
  const card = container.querySelector('.card-collapsed')
  if (card) await userEvent.click(card)
}

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
  const { container } = render(<EntryCard entry={base} {...handlers} onTogglePin={onTogglePin} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /pin/i }))
  expect(onTogglePin).toHaveBeenCalledWith('x', true)
})

test('edits the note and saves on Done', async () => {
  const onNoteSave = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit note/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.clear(editor)
  await userEvent.type(editor, 'updated note')
  await userEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(onNoteSave).toHaveBeenCalledWith('x', 'updated note')
})

test('changes status', async () => {
  const onStatusChange = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onStatusChange={onStatusChange} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox', { name: '' }), 'done')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})

test('delete asks for confirmation, then fires onDelete', async () => {
  const onDelete = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onDelete={onDelete} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /move to trash/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})

test('a link-only entry can still reach delete', async () => {
  // Regression: entries with a URL and no note render as a bookmark card whose
  // face is one big <a> that stops propagation, so click-to-expand never fires.
  // Without the explicit actions button the entry was undeletable.
  const onDelete = vi.fn()
  const linkOnly = { ...base, note: '', og_description: 'a description' }
  render(<EntryCard entry={linkOnly} {...handlers} onDelete={onDelete} />)

  await userEvent.click(screen.getByRole('button', { name: /show actions/i }))
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  await userEvent.click(screen.getByRole('button', { name: /move to trash/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})

test('edits tags through TagInput', async () => {
  const onTagsChange = vi.fn()
  const { container } = render(<EntryCard entry={{ ...base, tags: [] }} {...handlers} onTagsChange={onTagsChange} />)
  await expandCard(container)
  await userEvent.type(screen.getByPlaceholderText(/add tag/i), 'book{Enter}')
  expect(onTagsChange).toHaveBeenCalledWith('x', ['book'])
})

test('preview button shows filename from URL', async () => {
  const entry = { ...base, url: 'https://storage.example.com/user/abc-report.pdf', title: 'Report' }
  // classifyUrl needs to return non-null so the preview button renders
  const { container } = render(<EntryCard entry={entry} {...handlers} onPreview={() => {}} />)
  await expandCard(container)
  expect(screen.getByRole('button', { name: /report\.pdf/i })).toBeInTheDocument()
})

test('clicking edit title button enters edit mode', async () => {
  const onTitleChange = vi.fn()
  const noUrl = { ...base, url: null }
  const { container } = render(<EntryCard entry={noUrl} {...handlers} onTitleChange={onTitleChange} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit title/i }))
  expect(screen.getByRole('textbox', { name: /edit title/i })).toBeInTheDocument()
})

test('saves title on Enter', async () => {
  const onTitleChange = vi.fn()
  const noUrl = { ...base, url: null }
  const { container } = render(<EntryCard entry={noUrl} {...handlers} onTitleChange={onTitleChange} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit title/i }))
  const input = screen.getByRole('textbox', { name: /edit title/i })
  await userEvent.clear(input)
  await userEvent.type(input, 'New Title{Enter}')
  expect(onTitleChange).toHaveBeenCalledWith('x', 'New Title', undefined, true)
})

test('cancels title edit on Escape', async () => {
  const onTitleChange = vi.fn()
  const noUrl = { ...base, url: null }
  const { container } = render(<EntryCard entry={noUrl} {...handlers} onTitleChange={onTitleChange} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit title/i }))
  const input = screen.getByRole('textbox', { name: /edit title/i })
  await userEvent.type(input, '{Escape}')
  expect(onTitleChange).not.toHaveBeenCalled()
  expect(screen.queryByRole('textbox', { name: /edit title/i })).toBeNull()
})

test('URL title edit button enters edit mode', async () => {
  const onTitleChange = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onTitleChange={onTitleChange} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit title/i }))
  expect(screen.getByRole('textbox', { name: /edit title/i })).toBeInTheDocument()
})

test('shows saving indicator while autosave timer is pending', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const onNoteSave = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit note/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.type(editor, 'x')
  expect(screen.getByText(/saving/i)).toBeInTheDocument()
  vi.useRealTimers()
})

test('collapsed by default — edit note button not visible until expanded', () => {
  render(<EntryCard entry={base} {...handlers} />)
  expect(screen.queryByRole('button', { name: /edit note/i })).toBeNull()
})

test('clicking collapsed card expands it', async () => {
  const { container } = render(<EntryCard entry={base} {...handlers} />)
  await expandCard(container)
  expect(screen.getByRole('button', { name: /edit note/i })).toBeInTheDocument()
})

test('move select calls onMove and disappears entry', async () => {
  const onMove = vi.fn()
  const targets = [{ id: 't2', name: 'Books' }]
  const { container } = render(
    <EntryCard entry={base} {...handlers} moveTargets={targets} onMove={onMove} />
  )
  await expandCard(container)
  const moveSelect = container.querySelector('.move-select')
  await userEvent.selectOptions(moveSelect, 't2')
  expect(onMove).toHaveBeenCalledWith('x', 't2')
})

test('shows no-note chip for entries with no note older than 14 days', () => {
  const oldDate = new Date(Date.now() - 15 * 86400000).toISOString()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false, created_at: oldDate }
  const { container } = render(<EntryCard entry={entry} {...handlers} />)
  expect(screen.getByText(/no notes/i)).toBeInTheDocument()
  expect(container.querySelector('.card-aged-no-note')).not.toBeNull()
})

test('does not show no-note chip when note exists even if old', () => {
  const oldDate = new Date(Date.now() - 15 * 86400000).toISOString()
  const entry = { ...base, created_at: oldDate }
  const { container } = render(<EntryCard entry={entry} {...handlers} />)
  expect(screen.queryByText(/no notes/i)).not.toBeInTheDocument()
  expect(container.querySelector('.card-aged-no-note')).toBeNull()
})

test('does not show no-note chip for entries newer than 14 days with no note', () => {
  const recentDate = new Date(Date.now() - 10 * 86400000).toISOString()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false, created_at: recentDate }
  const { container } = render(<EntryCard entry={entry} {...handlers} />)
  expect(screen.queryByText(/no notes/i)).not.toBeInTheDocument()
  expect(container.querySelector('.card-aged-no-note')).toBeNull()
})

test('shows takeaway prompt when transitioning to done with no note', async () => {
  const onStatusChange = vi.fn()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false }
  const { container } = render(<EntryCard entry={entry} {...handlers} onStatusChange={onStatusChange} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(screen.getByText(/any final takeaway/i)).toBeInTheDocument()
  expect(onStatusChange).not.toHaveBeenCalled()
})

test('skip on takeaway prompt calls onStatusChange with done', async () => {
  const onStatusChange = vi.fn()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false }
  const { container } = render(<EntryCard entry={entry} {...handlers} onStatusChange={onStatusChange} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  await userEvent.click(screen.getByRole('button', { name: /skip/i }))
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
  expect(screen.queryByText(/any final takeaway/i)).not.toBeInTheDocument()
})

test('save on takeaway prompt calls onNoteSave then onStatusChange with done', async () => {
  const onStatusChange = vi.fn()
  const onNoteSave = vi.fn()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false }
  const { container } = render(<EntryCard entry={entry} {...handlers} onStatusChange={onStatusChange} onNoteSave={onNoteSave} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  await userEvent.type(screen.getByPlaceholderText(/what did you learn/i), 'my takeaway')
  await userEvent.click(screen.getByRole('button', { name: /save & done/i }))
  expect(onNoteSave).toHaveBeenCalledWith('x', 'my takeaway')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})

test('skips takeaway prompt when transitioning to done with existing note', async () => {
  const onStatusChange = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onStatusChange={onStatusChange} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(screen.queryByText(/any final takeaway/i)).not.toBeInTheDocument()
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})

test('autosave failure shows Save failed text', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const onNoteSave = vi.fn().mockRejectedValue(new Error('network error'))
  const { container } = render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit note/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.type(editor, 'x')
  await vi.runAllTimersAsync()
  expect(screen.getByText(/save failed/i)).toBeInTheDocument()
  vi.useRealTimers()
})

test('successful save after failure clears Save failed', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const onNoteSave = vi.fn().mockRejectedValueOnce(new Error('network error')).mockResolvedValue()
  const { container } = render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit note/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.type(editor, 'x')
  await vi.runAllTimersAsync()
  expect(screen.getByText(/save failed/i)).toBeInTheDocument()
  // next keystroke triggers new autosave that succeeds
  await userEvent.type(editor, 'y')
  await vi.runAllTimersAsync()
  expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument()
  vi.useRealTimers()
})

test('Done button retries save when status is failed and keeps editor open on failure', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const onNoteSave = vi.fn().mockRejectedValue(new Error('network error'))
  const { container } = render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit note/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.type(editor, 'x')
  await vi.runAllTimersAsync()
  expect(screen.getByText(/save failed/i)).toBeInTheDocument()
  const callsBefore = onNoteSave.mock.calls.length
  // Click Done — should call save again, not close
  await userEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(onNoteSave.mock.calls.length).toBeGreaterThan(callsBefore)
  // editor still open because save failed
  expect(screen.getByLabelText('note editor')).toBeInTheDocument()
  vi.useRealTimers()
})

// --- snooze lands on the day the user picked -------------------------------
// `dateStr + 'T00:00:00Z'` was UTC midnight: in Detroit that instant is still
// the previous evening, so an entry snoozed to tomorrow came back at 8pm
// tonight. Pinning the zone here rather than trusting the runner's is the
// point — under UTC the old bug is invisible.
test('snooze stores the start of the picked day in the user timezone', async () => {
  localStorage.setItem('medialog_timezone', 'America/Detroit')
  const { container } = render(<EntryCard entry={base} {...handlers} supabase={{}} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: 'snooze' }))
  await userEvent.type(container.querySelector('.snooze-picker input'), '2026-09-11')

  expect(snoozeEntry).toHaveBeenCalledTimes(1)
  const iso = snoozeEntry.mock.calls[0][2]
  // Detroit is UTC-4 in September, so local midnight is 04:00Z — and, crucially,
  // reads as the 11th in Detroit rather than the 10th.
  expect(iso).toBe('2026-09-11T04:00:00.000Z')
  expect(new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Detroit' })).toBe('2026-09-11')
  localStorage.removeItem('medialog_timezone')
})

// --- a due date has to be visible without opening the card -----------------
test('a collapsed card shows its due date', () => {
  const dated = { ...base, due_at: '2026-09-11T23:59:59.999Z' }
  const { container } = render(<EntryCard entry={dated} {...handlers} />)
  expect(container.querySelector('.card-collapsed')).not.toBeNull()
  const badge = container.querySelector('.due-badge')
  expect(badge).not.toBeNull()
  // Read-only on the collapsed face: editing stays in the expanded card.
  expect(badge.tagName).toBe('SPAN')
})

test('a collapsed bookmark card shows its due date too', () => {
  const dated = { id: 'b', url: 'http://a.com', title: 'A Site', note: '', og_description: 'desc', tags: [], due_at: '2026-09-11T23:59:59.999Z' }
  const { container } = render(<EntryCard entry={dated} {...handlers} />)
  expect(container.querySelector('.card-bookmark')).not.toBeNull()
  expect(container.querySelector('.due-badge')).not.toBeNull()
})

test('an undated collapsed card adds no badge element at all', () => {
  // The layout must not shift for the ~1,300 entries with no due date: the
  // meta row's flex gap only spaces elements that exist.
  const { container } = render(<EntryCard entry={base} {...handlers} />)
  expect(container.querySelector('.due-badge')).toBeNull()
})
