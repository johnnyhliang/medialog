import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import HomeReviewSummary from '../../../src/components/HomeReviewSummary.jsx'
import { getReviewCounts } from '../../../src/lib/db/review.js'

// The seven queries this component used to run inline now live in
// `src/lib/db/review.js` and are asserted there against a fake client. What is
// left to test here is the part that was previously buried under a
// hand-written Supabase mock that had to guess which query it was answering
// from the filters it had been handed: which badges appear, and which single
// recommendation wins.
vi.mock('../../../src/lib/db/review.js', () => ({ getReviewCounts: vi.fn() }))

const counts = (over = {}) => ({
  inbox: 0, oldInbox: 0, staleBacklog: 0, active: 0, dormant: 0, ...over,
})

function setup(over) {
  getReviewCounts.mockResolvedValue(counts(over))
  const onSortInbox = vi.fn()
  const onGoToDigest = vi.fn()
  render(<HomeReviewSummary supabase={{}} onSortInbox={onSortInbox} onGoToDigest={onGoToDigest} />)
  return { onSortInbox, onGoToDigest }
}

beforeEach(() => vi.clearAllMocks())

describe('HomeReviewSummary', () => {
  it('renders inbox count badge when inbox > 0', async () => {
    setup({ inbox: 5 })
    await waitFor(() => {
      expect(screen.getByText('5')).toBeTruthy()
      expect(screen.getByText('inbox')).toBeTruthy()
    })
  })

  it('hides old badge when old inbox count is 0', async () => {
    setup({ inbox: 3 })
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy())
    expect(screen.queryByText('old')).toBeNull()
  })

  it('shows correct recommended action text for old inbox scenario', async () => {
    setup({ inbox: 4, oldInbox: 2 })
    await waitFor(() => {
      expect(screen.getByText(/Sort your inbox/)).toBeTruthy()
      expect(screen.getByText(/2 items are more than 2 weeks old/)).toBeTruthy()
    })
  })

  it('shows "Inbox is clear" when all counts are 0', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Inbox is clear — nice.')).toBeTruthy())
  })

  it('recommends one thing at a time, oldest inbox first', async () => {
    setup({ inbox: 9, oldInbox: 1, staleBacklog: 20, active: 9 })
    await waitFor(() => expect(screen.getByText(/Sort your inbox/)).toBeTruthy())
    expect(screen.queryByText(/active queue is full/)).toBeNull()
  })

  it('shows the dormant badge and routes it to the digest', async () => {
    const { onGoToDigest } = setup({ dormant: 4 })
    await waitFor(() => expect(screen.getByText('dormant')).toBeTruthy())
    screen.getByTitle('Dormant topics').click()
    expect(onGoToDigest).toHaveBeenCalled()
  })

  it('renders nothing at all when the counts cannot be loaded', async () => {
    // The important half of this: a failure must not fall through to five
    // zeroes, because "all clear" is the opposite of what happened.
    getReviewCounts.mockRejectedValue(new Error('down'))
    const { container } = render(
      <HomeReviewSummary supabase={{}} onSortInbox={vi.fn()} onGoToDigest={vi.fn()} />,
    )
    await waitFor(() => expect(getReviewCounts).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
