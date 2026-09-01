import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import RelatedEntries from '../../../src/components/RelatedEntries.jsx'

vi.mock('../../../src/lib/db/retrieval.js', () => ({
  relatedTo: vi.fn(async () => [
    { entryId: 'e2', content: 'market makers quote both sides', heading: 'Market making', score: 0.04 },
  ]),
}))

beforeEach(() => vi.clearAllMocks())

test('does not query until the user asks for related items', async () => {
  const { relatedTo } = await import('../../../src/lib/db/retrieval.js')
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  // critical: rendering a list of cards must not fire N queries
  expect(relatedTo).not.toHaveBeenCalled()
})

test('fetches and lists related passages when clicked', async () => {
  const { relatedTo } = await import('../../../src/lib/db/retrieval.js')
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /related/i }))
  await waitFor(() => expect(relatedTo).toHaveBeenCalledWith(
    expect.anything(), expect.objectContaining({ entryId: 'e1' }),
  ))
  expect(await screen.findByText(/market makers quote both sides/i)).toBeTruthy()
})

test('opens the related entry when a result is clicked', async () => {
  const onOpen = vi.fn()
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={onOpen} />)
  fireEvent.click(screen.getByRole('button', { name: /related/i }))
  fireEvent.click(await screen.findByText(/market makers quote both sides/i))
  expect(onOpen).toHaveBeenCalledWith('e2')
})

test('reports when there is nothing related', async () => {
  const { relatedTo } = await import('../../../src/lib/db/retrieval.js')
  relatedTo.mockResolvedValueOnce([])
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /related/i }))
  expect(await screen.findByText(/nothing related/i)).toBeTruthy()
})

// The whole point of commit 22448bf: a failed lookup must not be able to
// masquerade as "this entry has no neighbours". These two tests are a pair —
// each one is only meaningful because the other exists.
test('a failed lookup reports the failure instead of claiming nothing is related', async () => {
  const { relatedTo } = await import('../../../src/lib/db/retrieval.js')
  relatedTo.mockRejectedValueOnce(new Error('connection refused'))
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /related/i }))
  expect(await screen.findByText(/couldn’t load related entries/i)).toBeTruthy()
  expect(screen.getByText(/connection refused/)).toBeTruthy()
  // the empty copy is the wrong answer here, not merely a less good one
  expect(screen.queryByText(/nothing related/i)).toBeNull()
  // and the retry affordance comes back, which the empty state does not offer
  expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
})

test('a genuine empty result does not render as an error', async () => {
  const { relatedTo } = await import('../../../src/lib/db/retrieval.js')
  relatedTo.mockResolvedValueOnce([])
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /related/i }))
  expect(await screen.findByText(/nothing related/i)).toBeTruthy()
  expect(screen.queryByText(/couldn’t load/i)).toBeNull()
})
