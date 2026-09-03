import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from '../../../src/components/EntryCard.jsx'

vi.mock('../../../src/components/NoteEditor.jsx', () => ({
  default: () => <textarea aria-label="note editor" />,
}))

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'a note', status: null, tags: [], pinned: false }
const noop = () => {}
const handlers = { onDelete: noop, onStatusChange: noop, onTagsChange: noop, onTogglePin: noop, onNoteSave: noop }

async function expandCard(container) {
  const card = container.querySelector('.card-collapsed')
  if (card) await userEvent.click(card)
}

test('an undated card renders exactly as before when no handler is supplied', async () => {
  // Most of the library — ~1,300 of ~1,400 entries — has no due date. Adding
  // the feature must not put a control on all of them.
  const { container } = render(<EntryCard entry={base} {...handlers} />)
  await expandCard(container)
  expect(container.querySelector('.due-badge')).toBeNull()
  expect(container.querySelector('.card-add-due-btn')).toBeNull()
})

test('an undated card gets a quiet affordance once an owner can save', async () => {
  const { container } = render(<EntryCard entry={base} {...handlers} onDueDateChange={vi.fn()} />)
  await expandCard(container)
  expect(screen.getByRole('button', { name: /add due date/i })).toBeInTheDocument()
})

test('sets a due date through the owner, not the database', async () => {
  const onDueDateChange = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onDueDateChange={onDueDateChange} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /add due date/i }))
  await userEvent.type(screen.getByLabelText('due date'), '2026-09-11')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(onDueDateChange).toHaveBeenCalledTimes(1)
  const [id, iso] = onDueDateChange.mock.calls[0]
  expect(id).toBe('x')
  // Whatever the runner's zone is, the instant must still read as Sep 11 there
  // — that is the UTC-midnight off-by-one this control exists to avoid.
  expect(new Date(iso).toLocaleDateString('en-CA')).toBe('2026-09-11')
})

test('clears a due date from the badge itself', async () => {
  const onDueDateChange = vi.fn()
  const dated = { ...base, due_at: '2026-09-11T23:59:59.999Z' }
  const { container } = render(<EntryCard entry={dated} {...handlers} onDueDateChange={onDueDateChange} />)
  await expandCard(container)
  await userEvent.click(container.querySelector('.due-badge'))
  await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(onDueDateChange).toHaveBeenCalledWith('x', null)
})

test('the badge stays a plain label with no handler to call', async () => {
  const dated = { ...base, due_at: '2026-09-11T23:59:59.999Z' }
  const { container } = render(<EntryCard entry={dated} {...handlers} />)
  await expandCard(container)
  const badge = container.querySelector('.due-badge')
  expect(badge).not.toBeNull()
  expect(badge.tagName).toBe('SPAN')
})
