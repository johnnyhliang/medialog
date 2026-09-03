import { describe, expect, it, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DueBadge from '../../../src/components/DueBadge.jsx'

const TZ = 'America/Detroit'
const NOW = new Date('2026-09-07T14:00:00Z') // 10am Detroit
const hours = (h) => new Date(NOW.getTime() + h * 3600 * 1000).toISOString()

afterEach(() => vi.useRealTimers())

describe('DueBadge', () => {
  it('renders nothing for an undated entry', () => {
    // The reason this matters: 1,300 of ~1,400 entries have no due date, and
    // the card must look exactly as it did for all of them.
    const { container } = render(<DueBadge dueAt={null} timezone={TZ} now={NOW} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for an unparseable date rather than throwing', () => {
    const { container } = render(<DueBadge dueAt="not a date" timezone={TZ} now={NOW} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('marks something already past as overdue', () => {
    render(<DueBadge dueAt={hours(-30)} timezone={TZ} now={NOW} />)
    expect(screen.getByText('overdue')).toBeInTheDocument()
  })

  it('says today for something due later the same day', () => {
    render(<DueBadge dueAt={hours(6)} timezone={TZ} now={NOW} />)
    expect(screen.getByText('today')).toBeInTheDocument()
  })

  it('uses the local day, not the UTC one, for a late-evening deadline', () => {
    // 9pm Detroit today is already tomorrow in UTC. Bucketing on UTC would
    // label tonight's deadline as "this week" from 8pm onward every evening.
    const ninePmDetroit = new Date('2026-09-08T01:00:00Z').toISOString()
    render(<DueBadge dueAt={ninePmDetroit} timezone={TZ} now={NOW} />)
    expect(screen.getByText('today')).toBeInTheDocument()
  })

  it('shows a weekday for something later this week', () => {
    render(<DueBadge dueAt={hours(48)} timezone={TZ} now={NOW} />)
    expect(screen.getByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/)).toBeInTheDocument()
  })

  it('shows a date for something further out', () => {
    render(<DueBadge dueAt={'2026-10-15T16:00:00Z'} timezone={TZ} now={NOW} />)
    expect(screen.getByText(/Oct 15/)).toBeInTheDocument()
  })

  it('carries the full timestamp in a tooltip', () => {
    const { container } = render(<DueBadge dueAt={hours(6)} timezone={TZ} now={NOW} />)
    expect(container.querySelector('.due-badge').title).toMatch(/Due Sep 7, 2026/)
  })

  it('falls back to a resolvable timezone when none is passed', () => {
    // EntryCard renders hundreds of these and has no timezone prop; the badge
    // must not blow up or need one.
    render(<DueBadge dueAt={hours(-30)} now={NOW} />)
    expect(screen.getByText('overdue')).toBeInTheDocument()
  })
})
