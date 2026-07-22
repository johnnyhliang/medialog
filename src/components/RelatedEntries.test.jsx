import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import RelatedEntries from './RelatedEntries.jsx'

vi.mock('../lib/db/retrieval.js', () => ({
  relatedTo: vi.fn(async () => [
    { entryId: 'e2', content: 'market makers quote both sides', heading: 'Market making', score: 0.04 },
  ]),
}))

beforeEach(() => vi.clearAllMocks())

test('does not query until the user asks for related items', async () => {
  const { relatedTo } = await import('../lib/db/retrieval.js')
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  // critical: rendering a list of cards must not fire N queries
  expect(relatedTo).not.toHaveBeenCalled()
})

test('fetches and lists related passages when clicked', async () => {
  const { relatedTo } = await import('../lib/db/retrieval.js')
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
  const { relatedTo } = await import('../lib/db/retrieval.js')
  relatedTo.mockResolvedValueOnce([])
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /related/i }))
  expect(await screen.findByText(/nothing related/i)).toBeTruthy()
})
