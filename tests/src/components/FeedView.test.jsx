// Regression cover for the §4.3 sweep: src/lib/db/feeds.js now throws where it
// used to return `[]` / `{}`. These tests exist to prove the three states stay
// distinguishable — a failed load must never render as "you have no feeds".
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('../../../src/lib/db/feeds.js', () => ({
  listFeeds: vi.fn(),
  createFeed: vi.fn(),
  deleteFeed: vi.fn(),
  setFeedCategory: vi.fn(),
  listFeedItems: vi.fn(),
  dismissFeedItem: vi.fn(),
  markFeedItemSaved: vi.fn(),
  cullExpiredItems: vi.fn(),
  getFeedItemCounts: vi.fn(),
  addStarterFeeds: vi.fn(),
}))
vi.mock('../../../src/lib/db/entries.js', () => ({ listRecentActivity: vi.fn() }))
// GainsCard runs its own queries and is not what any of this is testing.
vi.mock('../../../src/components/GainsCard.jsx', () => ({ default: () => null }))

import FeedView from '../../../src/components/FeedView.jsx'
import {
  listFeeds, listFeedItems, getFeedItemCounts, cullExpiredItems, deleteFeed,
} from '../../../src/lib/db/feeds.js'
import { listRecentActivity } from '../../../src/lib/db/entries.js'

const supabase = { functions: { invoke: vi.fn(async () => ({ error: null })) } }

function renderView(props = {}) {
  return render(
    <FeedView supabase={supabase} topics={[]} allTags={[]} onSaveItem={vi.fn()} {...props} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  cullExpiredItems.mockResolvedValue(undefined)
  listRecentActivity.mockResolvedValue([])
  listFeeds.mockResolvedValue([])
  listFeedItems.mockResolvedValue([])
  getFeedItemCounts.mockResolvedValue({})
  supabase.functions.invoke.mockResolvedValue({ error: null })
})

describe('FeedView feed-list load failure', () => {
  test('shows an error and NOT the empty state when getFeedItemCounts throws', async () => {
    // The exact old bug: this used to resolve to `{}` and render as
    // "0 unread on every feed" over an apparently-empty sidebar.
    getFeedItemCounts.mockRejectedValue(new Error('counts exploded'))

    renderView()

    expect(await screen.findByText(/couldn’t load your feeds/)).toBeInTheDocument()
    expect(screen.getByText(/counts exploded/)).toBeInTheDocument()
    expect(screen.queryByText(/no feeds yet/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add starter pack/i })).not.toBeInTheDocument()
  })

  test('shows an error and NOT the empty state when listFeeds throws', async () => {
    listFeeds.mockRejectedValue(new Error('feeds exploded'))

    renderView()

    expect(await screen.findByText(/feeds exploded/)).toBeInTheDocument()
    expect(screen.queryByText(/no feeds yet/i)).not.toBeInTheDocument()
  })

  test('a genuinely empty feed list still renders the empty state', async () => {
    // The other half of the contract: guarding the empty state must not
    // suppress it when nothing is actually wrong.
    renderView()

    expect(await screen.findByText(/no feeds yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/couldn’t load your feeds/)).not.toBeInTheDocument()
  })

  test('a mount-time throw is caught, not left as an unhandled rejection', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    getFeedItemCounts.mockRejectedValue(new Error('counts exploded'))

    renderView()
    await screen.findByText(/couldn’t load your feeds/)
    await new Promise((r) => setTimeout(r, 0))
    process.off('unhandledRejection', unhandled)

    expect(unhandled).not.toHaveBeenCalled()
  })
})

describe('FeedView serverRefresh', () => {
  // A stale feed makes the mount effect kick off serverRefresh on its own,
  // which is the path where the reload used to sit outside the try/catch.
  const stale = [{ id: 'f1', name: 'Stale Blog', category: null, last_fetched_at: null }]

  test('does not leave refreshing stuck when the post-refresh reload throws', async () => {
    listFeeds.mockResolvedValueOnce(stale).mockRejectedValue(new Error('reload exploded'))

    renderView()

    // Generous timeouts: this path is two awaited reloads deep and the default
    // 1s window is flaky when the whole suite runs in parallel. waitFor rather
    // than holding the node findByText resolves to — see the sibling test.
    await waitFor(() => expect(screen.getByText(/reload exploded/)).toBeInTheDocument(), { timeout: 5000 })
    // Button label is '…' while refreshing and '↻' once it settles. Re-queried
    // inside each attempt so a re-render swapping the node cannot fail this.
    await waitFor(() => expect(screen.getByTitle('Refresh all feeds')).toHaveTextContent('↻'), { timeout: 5000 })
    expect(screen.getByTitle('Refresh all feeds')).not.toBeDisabled()
  })

  test('does not leave refreshing stuck when listFeedItems throws', async () => {
    listFeeds.mockResolvedValue(stale)
    listFeedItems.mockRejectedValue(new Error('items exploded'))

    renderView()

    // waitFor, not findByText-into-an-assertion: findByText resolves a NODE, and
    // asserting on that held reference races a re-render that replaces it. Passed
    // in isolation and failed only under full-suite parallel load, which is the
    // signature of a held-reference race rather than a slow query. waitFor
    // re-queries on every attempt, so a swapped node is not a failure.
    await waitFor(() => expect(screen.getByText(/items exploded/)).toBeInTheDocument(), { timeout: 5000 })
    await waitFor(() => expect(screen.getByTitle('Refresh all feeds')).toHaveTextContent('↻'), { timeout: 5000 })
  })
})

describe('FeedView handleDeleteFeed', () => {
  test('keeps the feed in the sidebar and toasts when the delete throws', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    listFeeds.mockResolvedValue([
      { id: 'f1', name: 'Keeper', category: null, last_fetched_at: new Date().toISOString() },
    ])
    deleteFeed.mockRejectedValue(new Error('delete exploded'))
    const addToast = vi.fn()

    renderView({ addToast })
    const del = await screen.findByTitle('Remove feed')
    del.click()

    await waitFor(() => expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('delete exploded'), 'error',
    ))
    expect(screen.getByText('Keeper')).toBeInTheDocument()
  })
})

// §6.1: the item age chip now comes from src/lib/timeFormat.js `shortAge`, not
// a local copy that stopped at days. These pin the two boundaries where the
// visible output actually changed, plus the missing-date fallback that the
// `?? '—'` at the call site depends on.
describe('FeedView item age', () => {
  const ago = (ms) => new Date(Date.now() - ms).toISOString()

  function itemWith(published_at) {
    return [{
      id: 'i1', feed_id: 'f1', title: 'An Article', url: 'https://example.com/a',
      summary: null, published_at, feeds: { name: 'Blog' },
    }]
  }

  async function ageText(published_at) {
    listFeedItems.mockResolvedValue(itemWith(published_at))
    // Scoped to this render's own container: some tests render twice, and a
    // global query would match the first render's row.
    const { container } = renderView()
    await waitFor(() => expect(container.querySelector('.feed-item-age')).not.toBeNull())
    return [...container.querySelectorAll('.feed-item-age')].at(-1).textContent
  }

  test('under a minute reads "just now", not "0m"', async () => {
    expect(await ageText(ago(30 * 1000))).toBe('just now')
  })

  test('past a year reads "1y", not a three-digit day count', async () => {
    expect(await ageText(ago(400 * 86400000))).toBe('1y')
  })

  test('weeks, which the old local copy rendered as days', async () => {
    expect(await ageText(ago(10 * 86400000))).toBe('1w')
  })

  test('months, which the old local copy rendered as days', async () => {
    expect(await ageText(ago(60 * 86400000))).toBe('2mo')
  })

  test('a missing published_at falls back to the em dash', async () => {
    expect(await ageText(null)).toBe('—')
  })
})
