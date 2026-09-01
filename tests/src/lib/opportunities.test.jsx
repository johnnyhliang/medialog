import { render, screen } from '@testing-library/react'
import { vi, test, expect, describe } from 'vitest'
import { OppRow, interleaved, matchesFilter } from '../../../src/lib/opportunities.jsx'

function makeItem(overrides = {}) {
  return {
    id: 'a',
    source: 'hn',
    company: 'Stripe',
    title: 'SWE Intern',
    body: null,
    url: 'https://hn.com/1',
    posted_at: new Date(Date.now() - 3600000).toISOString(),
    tags: ['hn'],
    is_read: false,
    is_saved: false,
    ...overrides,
  }
}

function renderRow(item) {
  return render(<OppRow item={item} onRead={vi.fn()} onSave={vi.fn()} onTrack={vi.fn()} />)
}

// The age chip moved from a local `formatAge` to the canonical `shortAge`, which
// changes what two ranges say on screen. Pinned because it is a visible change,
// not an accident of the refactor.
describe('age chip after adopting shortAge', () => {
  test('under a minute reads "just now" (was "0m")', () => {
    renderRow(makeItem({ posted_at: new Date(Date.now() - 20_000).toISOString() }))
    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  test('past a year reads "1y" (was "400d")', () => {
    renderRow(makeItem({ posted_at: new Date(Date.now() - 400 * 86400000).toISOString() }))
    expect(screen.getByText('1y')).toBeInTheDocument()
  })

  test('the middle of the range is unchanged', () => {
    renderRow(makeItem({ posted_at: new Date(Date.now() - 3 * 3600000).toISOString() }))
    expect(screen.getByText('3h')).toBeInTheDocument()
  })

  test('a missing posted_at renders nothing rather than throwing', () => {
    const { container } = renderRow(makeItem({ posted_at: null }))
    expect(container.querySelector('.opp-age').textContent).toBe('')
  })
})

test('the shared row keeps the body line the view had and the widget lacked', () => {
  renderRow(makeItem({ body: 'Remote — US' }))
  expect(screen.getByText('Remote — US')).toBeInTheDocument()
})

test('ATS sources get their green chip in both callers', () => {
  const { container } = renderRow(makeItem({ source: 'greenhouse' }))
  expect(container.querySelector('.opp-chip-green')).toBeTruthy()
})

test('interleaved round-robins sources by priority', () => {
  const items = [
    makeItem({ id: '1', source: 'github' }),
    makeItem({ id: '2', source: 'github' }),
    makeItem({ id: '3', source: 'twitter' }),
  ]
  expect(interleaved(items).map((i) => i.id)).toEqual(['3', '1', '2'])
})

test('the unified filter predicate covers both pill sets', () => {
  expect(matchesFilter(makeItem({ tags: ['internship'] }), 'SWE')).toBe(true)
  expect(matchesFilter(makeItem({ tags: ['pm'] }), 'PM')).toBe(true)
  expect(matchesFilter(makeItem({ is_read: true }), 'Unread')).toBe(false)
  expect(matchesFilter(makeItem({ tags: ['quant'] }), 'All')).toBe(true)
})
