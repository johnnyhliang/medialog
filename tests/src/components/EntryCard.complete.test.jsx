import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntryCard from '../../../src/components/EntryCard.jsx'

vi.mock('../../../src/lib/db/entries.js', () => ({
  snoozeEntry: vi.fn(() => Promise.resolve()),
  unsnoozeEntry: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../../src/components/NoteEditor.jsx', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="note editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const base = {
  id: 'e1', title: 'Email the 370 staff', url: null, note: '',
  tags: [], status: null, due_at: null,
}
const renderCard = (entry, props = {}) => render(
  <EntryCard
    entry={{ ...base, ...entry }}
    onStatusChange={props.onStatusChange ?? vi.fn()}
    onNoteSave={vi.fn()}
    onDueDateChange={vi.fn()}
    {...props}
  />,
)

describe('completing a task', () => {
  it('offers a done control on a dated entry', () => {
    renderCard({ due_at: '2026-09-11T03:59:59.999Z' })
    expect(screen.getByRole('button', { name: /mark task done/i })).toBeInTheDocument()
  })

  it('does not put a done control on an undated entry', () => {
    // The ~1,300 entries that are notes and links, not tasks.
    renderCard({ due_at: null })
    expect(screen.queryByRole('button', { name: /mark task done/i })).not.toBeInTheDocument()
  })

  it('completes in one tap without demanding a takeaway', async () => {
    // The bug: marking a note-less entry done opened a "what did you learn?"
    // prompt. Right for an article, wrong for an errand — and it meant tasks
    // never actually completed.
    const onStatusChange = vi.fn()
    renderCard({ due_at: '2026-09-11T03:59:59.999Z', note: '' }, { onStatusChange })
    await userEvent.click(screen.getByRole('button', { name: /mark task done/i }))
    expect(onStatusChange).toHaveBeenCalledWith('e1', 'done')
    expect(screen.queryByText(/takeaway/i)).not.toBeInTheDocument()
  })

  it('still asks an undated, note-less entry for a takeaway', async () => {
    // The friction is preserved exactly where it earns its place: a saved
    // article with nothing written about it is the case the prompt exists for.
    const onStatusChange = vi.fn()
    const { container } = renderCard({ due_at: null, note: '' }, { onStatusChange })
    await userEvent.click(container.querySelector('.card-collapsed'))
    const select = container.querySelector('.status-select')
    await userEvent.selectOptions(select, 'done')
    expect(onStatusChange).not.toHaveBeenCalledWith('e1', 'done')
  })

  it('reopens a completed task', async () => {
    const onStatusChange = vi.fn()
    renderCard({ due_at: '2026-09-11T03:59:59.999Z', status: 'done' }, { onStatusChange })
    await userEvent.click(screen.getByRole('button', { name: /reopen task/i }))
    expect(onStatusChange).toHaveBeenCalledWith('e1', null)
  })
})
