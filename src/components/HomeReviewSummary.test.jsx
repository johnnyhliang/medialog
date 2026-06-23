import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import HomeReviewSummary from './HomeReviewSummary.jsx'

function makeSupabase(counts = {}) {
  const {
    inboxTopicId = 'topic-inbox',
    inbox = 0,
    oldInbox = 0,
    staleBacklog = 0,
    active = 0,
    recentTopicIds = [],
    allTopics = [],
  } = counts

  // Build a chainable mock that resolves based on what's being queried
  const makeMock = (result) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      neq: () => chain,
      lt: () => chain,
      gte: () => chain,
      is: () => chain,
      maybeSingle: () => Promise.resolve(result),
      then: (resolve) => Promise.resolve(result).then(resolve),
    }
    // Allow count to be accessed directly
    Object.assign(chain, result)
    return chain
  }

  let callCount = 0
  const from = vi.fn((table) => {
    if (table === 'topics') {
      // first call: get inbox topic id; second call: all topics for dormant
      if (callCount === 0) {
        callCount++
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: inboxTopicId } }),
            }),
          }),
        }
      }
      // second topics call: all non-archived topics
      return {
        select: () => ({
          is: () => Promise.resolve({ data: allTopics }),
        }),
      }
    }
    if (table === 'entries') {
      // We need to distinguish the 5 entry queries by their chain
      // Use a counter-based approach
      const mock = {
        _filters: {},
        select: function (cols, opts) {
          this._cols = cols
          this._opts = opts
          return this
        },
        eq: function (col, val) { this._filters[col] = val; return this },
        neq: function (col, val) { return this },
        lt: function (col, val) { this._filters._lt = { col, val }; return this },
        gte: function (col, val) { this._filters._gte = { col, val }; return this },
        is: function () { return this },
        then: function (resolve) {
          // Identify query by filters
          const f = this._filters
          if (f.status === 'backlog') return Promise.resolve({ count: staleBacklog }).then(resolve)
          if (f.status === 'active') return Promise.resolve({ count: active }).then(resolve)
          if (f.topic_id && f._lt) return Promise.resolve({ count: oldInbox }).then(resolve)
          if (f.topic_id) return Promise.resolve({ count: inbox }).then(resolve)
          // recentTopicIds query
          return Promise.resolve({ data: recentTopicIds.map((id) => ({ topic_id: id })) }).then(resolve)
        },
      }
      return mock
    }
    return makeMock({ data: null })
  })

  return { from }
}

describe('HomeReviewSummary', () => {
  it('renders inbox count badge when inbox > 0', async () => {
    const supabase = makeSupabase({ inbox: 5, inboxTopicId: 'tid' })
    render(<HomeReviewSummary supabase={supabase} onSortInbox={() => {}} onGoToDigest={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('5')).toBeTruthy()
      expect(screen.getByText('inbox')).toBeTruthy()
    })
  })

  it('hides old badge when old inbox count is 0', async () => {
    const supabase = makeSupabase({ inbox: 3, oldInbox: 0, inboxTopicId: 'tid' })
    render(<HomeReviewSummary supabase={supabase} onSortInbox={() => {}} onGoToDigest={() => {}} />)
    await waitFor(() => {
      expect(screen.queryByText('old')).toBeNull()
    })
  })

  it('shows correct recommended action text for old inbox scenario', async () => {
    const supabase = makeSupabase({ inbox: 4, oldInbox: 2, inboxTopicId: 'tid' })
    render(<HomeReviewSummary supabase={supabase} onSortInbox={() => {}} onGoToDigest={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText(/Sort your inbox/)).toBeTruthy()
      expect(screen.getByText(/2 items are more than 2 weeks old/)).toBeTruthy()
    })
  })

  it('shows "Inbox is clear" when all counts are 0', async () => {
    const supabase = makeSupabase({ inbox: 0, oldInbox: 0, staleBacklog: 0, active: 0 })
    render(<HomeReviewSummary supabase={supabase} onSortInbox={() => {}} onGoToDigest={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('Inbox is clear — nice.')).toBeTruthy()
    })
  })
})
