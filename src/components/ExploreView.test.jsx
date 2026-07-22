import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import ExploreView from './ExploreView.jsx'

vi.mock('../lib/db/entries.js', () => ({
  searchEntries: vi.fn(async () => []),
  searchSemantic: vi.fn(async () => [{
    id: 'e1', title: 'Trading and Exchanges', note: '', status: 'active', topic_id: 't1',
    tags: [], topicName: 'Quant', similarity: null,
    passage: 'the spread compensates the maker for adverse selection',
    passageHeading: 'Adverse selection', passageAnchor: 'adverse-selection',
  }]),
  listReadingQueue: vi.fn(async () => []),
}))

beforeEach(() => vi.clearAllMocks())

test('semantic results render the matching passage, not a percentage', async () => {
  render(<ExploreView supabase={{}} topics={[]} onSelectEntry={vi.fn()} onOrderedIds={vi.fn()} />)
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'adverse' } })
  fireEvent.click(await screen.findByRole('button', { name: /semantic/i }))
  expect(await screen.findByText(/spread compensates the maker/i)).toBeTruthy()
  // RRF score must never be shown as a similarity percentage
  expect(screen.queryByText(/^\d+%$/)).toBeNull()
})

test('clicking a passage result passes the entry (with its anchor) up', async () => {
  const onSelect = vi.fn()
  render(<ExploreView supabase={{}} topics={[]} onSelectEntry={onSelect} onOrderedIds={vi.fn()} />)
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'adverse' } })
  fireEvent.click(await screen.findByRole('button', { name: /semantic/i }))
  fireEvent.click(await screen.findByText('Trading and Exchanges'))
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'e1', passageAnchor: 'adverse-selection' }),
  ))
})
