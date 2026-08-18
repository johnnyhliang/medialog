import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { vi, test, expect } from 'vitest'
import Revisit from '../../../src/components/Revisit.jsx'

const entries = [
  { id: 'a', url: 'http://a.com', title: 'A', note: 'note a', tags: [] },
  { id: 'b', url: null, title: null, note: 'note b', tags: [] },
]

// Mirrors what App actually does: every successful action calls applySeen,
// which removes the entry from the queue (useRevisit). The queue shrinking IS
// the advance — the component must not also move a cursor, or it advances
// twice and shows every *other* entry. Handlers report false on failure, in
// which case nothing is removed and the same card stays up.
function Harness({ onSeen, onRate, onRetire, onArchive, onDelete }) {
  const [queue, setQueue] = useState(entries)
  const drop = (id) => setQueue((prev) => prev.filter((e) => e.id !== id))
  const wrap = (fn, idOf) => fn && (async (...args) => {
    const ok = await fn(...args)
    if (ok !== false) drop(idOf(...args))
    return ok
  })
  return (
    <Revisit
      entries={queue}
      onSeen={wrap(onSeen, (id) => id)}
      onRate={wrap(onRate, (entry) => entry.id)}
      onRetire={wrap(onRetire, (entry) => entry.id)}
      onArchive={wrap(onArchive, (entry) => entry.id)}
      onDelete={wrap(onDelete, (entry) => entry.id)}
    />
  )
}

test('shows the first entry and advances on rating', async () => {
  const onSeen = vi.fn(() => Promise.resolve())
  const onRate = vi.fn(() => Promise.resolve())
  render(<Harness onSeen={onSeen} onRate={onRate} />)
  expect(screen.getByText('note a')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /good/i }))
  expect(onRate).toHaveBeenCalledWith(entries[0], 4)
  expect(screen.getByText('note b')).toBeInTheDocument()
})

test('every entry in the queue is reviewed, none skipped', async () => {
  // Regression: the component used to bump an index *and* the parent removed
  // the entry, so a three-entry queue only ever showed the first and third.
  const onRate = vi.fn(() => Promise.resolve())
  render(<Harness onSeen={vi.fn()} onRate={onRate} />)
  expect(screen.getByText('note a')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /good/i }))
  expect(screen.getByText('note b')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /good/i }))
  expect(onRate.mock.calls.map(([e]) => e.id)).toEqual(['a', 'b'])
  expect(screen.getByText(/nothing to resurface/i)).toBeInTheDocument()
})

test('shows empty message when nothing to revisit', () => {
  render(<Revisit entries={[]} onSeen={() => {}} />)
  expect(screen.getByText(/nothing to resurface/i)).toBeInTheDocument()
})

test('retiring ends the loop for that entry and advances', async () => {
  const onRetire = vi.fn(() => Promise.resolve())
  render(<Harness onSeen={vi.fn()} onRate={vi.fn()} onRetire={onRetire} />)
  await userEvent.click(screen.getByRole('button', { name: /done with it/i }))
  expect(onRetire).toHaveBeenCalledWith(entries[0])
  expect(screen.getByText('note b')).toBeInTheDocument()
})

test('the retire button is absent when no handler is wired', () => {
  render(<Revisit entries={entries} onSeen={() => {}} onRate={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /done with it/i })).not.toBeInTheDocument()
})

test('skip stamps the entry so it goes to the back of the queue', async () => {
  // Was a bare index bump: nothing was written, so listForRevisit (ordered by
  // last_surfaced_at, nulls first) put the same entry back at the front.
  const onSeen = vi.fn(() => Promise.resolve())
  render(<Harness onSeen={onSeen} onRate={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /^skip$/i }))
  expect(onSeen).toHaveBeenCalledWith('a')
  expect(screen.getByText('note b')).toBeInTheDocument()
})

test('archive and trash are reachable from the card and advance', async () => {
  const onArchive = vi.fn(() => Promise.resolve())
  const onDelete = vi.fn(() => Promise.resolve())
  render(<Harness onSeen={vi.fn()} onRate={vi.fn()} onArchive={onArchive} onDelete={onDelete} />)
  await userEvent.click(screen.getByRole('button', { name: /archive this entry/i }))
  expect(onArchive).toHaveBeenCalledWith(entries[0])
  await userEvent.click(screen.getByRole('button', { name: /move this entry to trash/i }))
  expect(onDelete).toHaveBeenCalledWith(entries[1])
})

test('a failed archive does not advance past the entry', async () => {
  // The handler reports false rather than throwing, and leaves the entry in the
  // queue; the card must stay put rather than dropping out of the session while
  // the entry was never archived.
  const onArchive = vi.fn(() => Promise.resolve(false))
  render(<Harness onSeen={vi.fn()} onRate={vi.fn()} onArchive={onArchive} />)
  await userEvent.click(screen.getByRole('button', { name: /archive this entry/i }))
  expect(onArchive).toHaveBeenCalledWith(entries[0])
  expect(screen.getByText('note a')).toBeInTheDocument()
})
