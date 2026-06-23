import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// Mock supabaseClient so DigestView doesn't need a real connection
vi.mock('../lib/supabaseClient.js', () => ({ supabase: {} }))

// Mock computeDigest so we control data
vi.mock('../lib/db/digest.js', () => ({
  computeDigest: vi.fn(),
}))

import DigestView from './DigestView.jsx'
import { computeDigest } from '../lib/db/digest.js'

function makeData(overrides = {}) {
  return {
    captured: [],
    completed: [],
    staleBacklog: [],
    oldInbox: [],
    readingQueue: [],
    dormantTopics: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DigestView CTAs', () => {
  it('renders Sort Inbox CTA when old inbox items exist', async () => {
    computeDigest.mockResolvedValue(makeData({
      oldInbox: [
        { id: '1', title: 'Old Item', created_at: '2026-05-01T00:00:00Z' },
        { id: '2', title: 'Old Item 2', created_at: '2026-05-01T00:00:00Z' },
      ],
    }))

    render(
      <DigestView
        topics={[]}
        inboxTopicId="inbox-1"
        onSortInbox={() => {}}
        onGoToView={() => {}}
        onOpenEntry={() => {}}
        onStatusChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Sort Inbox \(2 old items\)/)).toBeTruthy()
    })
  })

  it('calls onSortInbox when Sort Inbox CTA is clicked', async () => {
    const onSortInbox = vi.fn()
    computeDigest.mockResolvedValue(makeData({
      oldInbox: [{ id: '1', title: 'Old', created_at: '2026-05-01T00:00:00Z' }],
    }))

    render(
      <DigestView
        topics={[]}
        inboxTopicId="inbox-1"
        onSortInbox={onSortInbox}
        onGoToView={() => {}}
        onOpenEntry={() => {}}
        onStatusChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Sort Inbox/)).toBeTruthy()
    })

    fireEvent.click(screen.getByText(/Sort Inbox/))
    expect(onSortInbox).toHaveBeenCalledOnce()
  })

  it('does not render Sort Inbox CTA when old inbox is empty', async () => {
    computeDigest.mockResolvedValue(makeData())

    render(
      <DigestView
        topics={[]}
        inboxTopicId="inbox-1"
        onSortInbox={() => {}}
        onGoToView={() => {}}
        onOpenEntry={() => {}}
        onStatusChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText(/Sort Inbox/)).toBeNull()
    })
  })
})

describe('DigestView entry-level actions', () => {
  it('renders Open button on digest items with entry_id', async () => {
    computeDigest.mockResolvedValue(makeData({
      staleBacklog: [
        { id: 'e1', title: 'Stale Entry', created_at: '2025-01-01T00:00:00Z' },
      ],
    }))

    render(
      <DigestView
        topics={[]}
        inboxTopicId="inbox-1"
        onSortInbox={() => {}}
        onGoToView={() => {}}
        onOpenEntry={() => {}}
        onStatusChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Stale Entry')).toBeTruthy()
      expect(screen.getAllByText('Open').length).toBeGreaterThan(0)
    })
  })

  it('calls onOpenEntry when Open button is clicked', async () => {
    const onOpenEntry = vi.fn()
    const entry = { id: 'e1', title: 'Click Me', created_at: '2025-01-01T00:00:00Z', topic_id: 't1' }
    computeDigest.mockResolvedValue(makeData({
      staleBacklog: [entry],
    }))

    render(
      <DigestView
        topics={[]}
        inboxTopicId="inbox-1"
        onSortInbox={() => {}}
        onGoToView={() => {}}
        onOpenEntry={onOpenEntry}
        onStatusChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Click Me')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Open'))
    expect(onOpenEntry).toHaveBeenCalledWith(entry)
  })
})
