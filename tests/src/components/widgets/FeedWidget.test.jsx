// src/components/widgets/FeedWidget.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import FeedWidget from '../../../../src/components/widgets/FeedWidget.jsx'

function makeItem(overrides = {}) {
  return {
    id: 'i1',
    feed_id: 'f1',
    title: 'Test Article',
    url: 'https://example.com/article',
    summary: null,
    published_at: new Date(Date.now() - 7200000).toISOString(),
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    saved_at: null,
    dismissed_at: null,
    feeds: { name: 'Test Blog', category: null },
    ...overrides,
  }
}

// `feedsError` / `itemsError` go through the real feeds.js, so the throw under
// test is the one unwrap() actually produces rather than a hand-rolled stand-in.
function mockSupabase({ feeds = [{ id: 'f1' }], items = [], feedsError = null, itemsError = null } = {}) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const feedsResult = () => Promise.resolve(
    feedsError ? { data: null, error: { message: feedsError } } : { data: feeds, error: null })
  const itemsResult = () => Promise.resolve(
    itemsError ? { data: null, error: { message: itemsError } } : { data: items, error: null })
  return {
    from: vi.fn((table) => {
      if (table === 'feeds') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => feedsResult()),
            })),
          })),
        }
      }
      // feed_items
      return {
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            is: vi.fn(() => ({
              gt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => itemsResult()),
                })),
              })),
            })),
          })),
        })),
        update: updateFn,
      }
    }),
    _updateFn: updateFn,
  }
}

test('renders nothing when no feeds subscribed', async () => {
  const { container } = render(<FeedWidget supabase={mockSupabase({ feeds: [] })} onSave={vi.fn()} />)
  await waitFor(() => {})
  expect(container.firstChild).toBeNull()
})

test('renders feed items when feeds exist', async () => {
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], items: [makeItem()] })
  render(<FeedWidget supabase={sb} onSave={vi.fn()} />)
  expect(await screen.findByText('Test Article')).toBeInTheDocument()
  expect(screen.getByText('Test Blog')).toBeInTheDocument()
})

test('dismiss removes item from list', async () => {
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], items: [makeItem()] })
  render(<FeedWidget supabase={sb} onSave={vi.fn()} />)
  await screen.findByText('Test Article')
  await userEvent.click(screen.getByTitle('Dismiss'))
  expect(screen.queryByText('Test Article')).not.toBeInTheDocument()
  expect(sb._updateFn).toHaveBeenCalled()
})

test('save calls onSave callback and removes item', async () => {
  const onSave = vi.fn()
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], items: [makeItem()] })
  render(<FeedWidget supabase={sb} onSave={onSave} />)
  await screen.findByText('Test Article')
  await userEvent.click(screen.getByTitle('Save to MediaLog'))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Test Article' }))
  expect(sb._updateFn).toHaveBeenCalled()
})

test('shows empty state when feeds exist but no items', async () => {
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], items: [] })
  render(<FeedWidget supabase={sb} onSave={vi.fn()} />)
  expect(await screen.findByText(/no new items/i)).toBeInTheDocument()
})

// ── §4.3 sweep: listFeeds/listFeedItems throw now instead of returning [] ──
// The widget hides itself when the user has no feeds, so an uncaught throw here
// is invisible: it looks exactly like "not subscribed to anything".

test('renders an error instead of hiding when listFeeds throws', async () => {
  const sb = mockSupabase({ feedsError: 'feeds exploded' })
  const { container } = render(<FeedWidget supabase={sb} onSave={vi.fn()} />)
  expect(await screen.findByText(/couldn’t load your feed/)).toBeInTheDocument()
  expect(screen.getByText(/feeds exploded/)).toBeInTheDocument()
  // Distinct from the no-feeds state, which renders nothing at all.
  expect(container.firstChild).not.toBeNull()
})

test('an item-query throw shows the error, not the empty state', async () => {
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], itemsError: 'items exploded' })
  render(<FeedWidget supabase={sb} onSave={vi.fn()} />)
  expect(await screen.findByText(/items exploded/)).toBeInTheDocument()
  expect(screen.queryByText(/no new items/i)).not.toBeInTheDocument()
})

test('refreshing does not get stuck when the reload throws', async () => {
  const sb = mockSupabase({ feeds: [{ id: 'f1' }], items: [makeItem()] })
  render(<FeedWidget supabase={sb} onSave={vi.fn()} />)
  await screen.findByText('Test Article')

  // Break the item query, then refresh: the button must return to '↻'.
  sb.from = mockSupabase({ feeds: [{ id: 'f1' }], itemsError: 'items exploded' }).from
  await userEvent.click(screen.getByTitle('Refresh'))
  await waitFor(() => expect(screen.getByTitle('Refresh')).toHaveTextContent('↻'))
  expect(await screen.findByText(/items exploded/)).toBeInTheDocument()
})

// §6.1: the age chip now comes from src/lib/timeFormat.js `shortAge`. The old
// local `formatAge` returned '' for a dateless item; shortAge returns null,
// which React renders as the same empty chip — pinned below so that stays true.
test('age chip uses the shared compact formatter', async () => {
  const { container } = render(
    <FeedWidget supabase={mockSupabase({ items: [makeItem()] })} />)
  await screen.findByText('Test Article')
  expect(container.querySelector('.fw-age').textContent).toBe('2h')
})

test('under a minute reads "just now", not "0m"', async () => {
  const item = makeItem({ published_at: new Date(Date.now() - 30000).toISOString() })
  const { container } = render(<FeedWidget supabase={mockSupabase({ items: [item] })} />)
  await screen.findByText('Test Article')
  expect(container.querySelector('.fw-age').textContent).toBe('just now')
})

test('past a year reads "1y", not a three-digit day count', async () => {
  const item = makeItem({ published_at: new Date(Date.now() - 400 * 86400000).toISOString() })
  const { container } = render(<FeedWidget supabase={mockSupabase({ items: [item] })} />)
  await screen.findByText('Test Article')
  expect(container.querySelector('.fw-age').textContent).toBe('1y')
})

test('an item with no date at all renders an empty chip, not "null"', async () => {
  const item = makeItem({ published_at: null, fetched_at: null })
  const { container } = render(<FeedWidget supabase={mockSupabase({ items: [item] })} />)
  await screen.findByText('Test Article')
  expect(container.querySelector('.fw-age').textContent).toBe('')
})
