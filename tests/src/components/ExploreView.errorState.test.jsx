import { render, screen, fireEvent } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import ExploreView from '../../../src/components/ExploreView.jsx'

// Its own file rather than an append to ExploreView.test.jsx: these tests need
// `annotateEmbedded` and `track` stubbed so that the only thing which can throw
// is the search call itself. Adding those mocks to the existing file would
// change what every test in it exercises.
vi.mock('../../../src/lib/db/entries.js', () => ({
  searchEntries: vi.fn(async () => []),
  searchSemantic: vi.fn(async () => []),
  listReadingQueue: vi.fn(async () => []),
}))
vi.mock('../../../src/lib/db/retrieval.js', () => ({
  annotateEmbedded: vi.fn(async (_sb, rows) => rows),
}))
vi.mock('../../../src/lib/track.js', () => ({ track: vi.fn() }))

const { searchEntries } = await import('../../../src/lib/db/entries.js')

beforeEach(() => vi.clearAllMocks())

function search(term) {
  render(<ExploreView supabase={{}} topics={[]} onSelectEntry={vi.fn()} onOrderedIds={vi.fn()} />)
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: term } })
}

// The bug this covers: the catch only set an error when semantic mode was on,
// so a keyword search that threw cleared the spinner and said nothing at all.
test('a failed keyword search reports the failure', async () => {
  searchEntries.mockRejectedValueOnce(new Error('statement timeout'))
  search('rust')
  expect(await screen.findByText(/statement timeout/)).toBeTruthy()
})

test('a failed keyword search does not render as "no results"', async () => {
  searchEntries.mockRejectedValueOnce(new Error('statement timeout'))
  search('rust')
  await screen.findByText(/statement timeout/)
  expect(screen.queryByText('no results')).toBeNull()
})

test('a genuinely empty keyword search still says "no results", with no error', async () => {
  searchEntries.mockResolvedValueOnce([])
  search('rust')
  expect(await screen.findByText('no results')).toBeTruthy()
  expect(screen.queryByText(/timeout/)).toBeNull()
})
