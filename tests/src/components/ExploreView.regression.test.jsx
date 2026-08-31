import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { vi, test, expect, beforeEach } from 'vitest'
import ExploreView from '../../../src/components/ExploreView.jsx'
import { searchEntries, listReadingQueue } from '../../../src/lib/db/entries.js'

vi.mock('../../../src/lib/db/entries.js', () => ({
  searchEntries: vi.fn(async () => []),
  searchSemantic: vi.fn(async () => []),
  listReadingQueue: vi.fn(async () => []),
}))

// annotateEmbedded normally makes a second round trip; the races we care about
// are between the two search calls, so keep it a pass-through.
vi.mock('../../../src/lib/db/retrieval.js', () => ({
  annotateEmbedded: vi.fn(async (_supabase, rows) => rows),
}))

vi.mock('../../../src/lib/track.js', () => ({ track: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  searchEntries.mockImplementation(async () => [])
  listReadingQueue.mockImplementation(async () => [])
})

const entry = (id, title) => ({
  id, title, url: null, note: '', status: 'active', topic_id: 't1', tags: [], topicName: 'T',
})

// §3.1 — the ordered-ids effect must not feed itself. The parent stores what it
// receives in state, exactly as App does, so any unstable dependency turns into
// an unbounded render loop ("Maximum update depth exceeded").
test('reporting ordered ids to a stateful parent settles instead of looping', async () => {
  listReadingQueue.mockImplementation(async () => [entry('a', 'Alpha'), entry('b', 'Beta')])
  const calls = vi.fn()

  function Harness() {
    const [ids, setIds] = useState([])
    return (
      <>
        <ExploreView
          supabase={{}}
          topics={[]}
          onSelectEntry={vi.fn()}
          onOrderedIds={(next) => { calls(next); setIds(next) }}
        />
        <span data-testid="count">{ids.length}</span>
      </>
    )
  }

  render(<Harness />)
  await screen.findByText('Alpha')
  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
  // Let any self-perpetuating effect run a few more turns before we look.
  await new Promise((r) => setTimeout(r, 50))
  expect(calls.mock.calls.length).toBeLessThan(5)
})

// §3.2 — clearing the debounce timer cancels a search that has not started; it
// does nothing to one already in flight. A slow early query must not overwrite
// the results of the query that replaced it.
test('a slow earlier search cannot overwrite a newer one', async () => {
  searchEntries.mockImplementation((_supabase, q) => new Promise((resolve) => {
    if (q === 'rust') setTimeout(() => resolve([entry('r1', 'Stale earlier answer')]), 400)
    else setTimeout(() => resolve([entry('r2', 'Fresh newer answer')]), 0)
  }))

  render(<ExploreView supabase={{}} topics={[]} onSelectEntry={vi.fn()} onOrderedIds={vi.fn()} />)
  const input = screen.getByPlaceholderText(/search/i)

  fireEvent.change(input, { target: { value: 'rust' } })
  // Past the 300 ms debounce, so the slow request is genuinely in flight.
  await new Promise((r) => setTimeout(r, 340))
  fireEvent.change(input, { target: { value: 'rust traits' } })

  expect(await screen.findByText('Fresh newer answer')).toBeTruthy()
  // Long enough for the superseded `rust` request to resolve and try to write.
  await new Promise((r) => setTimeout(r, 500))
  expect(screen.queryByText('Stale earlier answer')).toBeNull()
  expect(screen.getByText('Fresh newer answer')).toBeTruthy()
})
