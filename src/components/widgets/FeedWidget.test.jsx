// src/components/widgets/FeedWidget.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import FeedWidget from './FeedWidget.jsx'

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

function mockSupabase({ feeds = [{ id: 'f1' }], items = [] } = {}) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  return {
    from: vi.fn((table) => {
      if (table === 'feeds') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: feeds, error: null })),
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
                  limit: vi.fn(() => Promise.resolve({ data: items, error: null })),
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
