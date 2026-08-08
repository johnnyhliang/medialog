import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContributionGrid from '../../../src/components/ContributionGrid.jsx'

const NOW = new Date('2026-08-07T15:00:00Z')
const NY = 'America/New_York'

const on = (day) => ({ day, kind: 'step' })

function squares(container) {
  return [...container.querySelectorAll('.cgrid-day')]
}

describe('ContributionGrid', () => {
  test('renders one square per day of the window', () => {
    const { container } = render(<ContributionGrid rows={[]} weeks={4} now={NOW} tz={NY} />)
    expect(squares(container)).toHaveLength(28)
  })

  test('empty state says so without implying failure', () => {
    render(<ContributionGrid rows={[]} weeks={4} now={NOW} tz={NY} />)
    expect(screen.getByText('no contributions yet')).toBeInTheDocument()
    // The words that must never appear on this surface.
    expect(screen.queryByText(/behind/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/missed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/goal/i)).not.toBeInTheDocument()
  })

  test('summarises total contributions and active days', () => {
    const rows = [on('2026-08-07'), on('2026-08-07'), on('2026-08-05')]
    render(<ContributionGrid rows={rows} weeks={4} now={NOW} tz={NY} />)
    expect(screen.getByText('3 contributions · 2 days')).toBeInTheDocument()
  })

  test('singularises one contribution on one day', () => {
    render(<ContributionGrid rows={[on('2026-08-07')]} weeks={4} now={NOW} tz={NY} />)
    expect(screen.getByText('1 contribution · 1 day')).toBeInTheDocument()
  })

  test('shades a square by count', () => {
    const rows = [on('2026-08-07'), on('2026-08-07')]
    const { container } = render(<ContributionGrid rows={rows} weeks={2} now={NOW} tz={NY} />)
    const filled = squares(container).filter((s) => s.className.includes('cgrid-day--l2'))
    expect(filled).toHaveLength(1)
  })

  test('future squares are marked and carry no tooltip', () => {
    const { container } = render(<ContributionGrid rows={[]} weeks={1} now={NOW} tz={NY} />)
    const future = squares(container).filter((s) => s.className.includes('cgrid-day--future'))
    // Friday the 7th is today, so Saturday the 8th is the only future square.
    expect(future).toHaveLength(1)
    expect(future[0].getAttribute('title')).toBe(null)
  })

  test('a past empty day reads as nothing, not as a miss', () => {
    const { container } = render(<ContributionGrid rows={[]} weeks={1} now={NOW} tz={NY} />)
    const past = squares(container).find((s) => !s.className.includes('future'))
    expect(past.getAttribute('title')).toMatch(/^nothing on \d{4}-\d{2}-\d{2}$/)
  })

  test('a streak of 2+ is shown', () => {
    const rows = [on('2026-08-07'), on('2026-08-06')]
    render(<ContributionGrid rows={rows} weeks={4} now={NOW} tz={NY} />)
    expect(screen.getByText('2 day run')).toBeInTheDocument()
  })

  test('a streak of 1 is not shown — it is noise dressed as an achievement', () => {
    render(<ContributionGrid rows={[on('2026-08-07')]} weeks={4} now={NOW} tz={NY} />)
    expect(screen.queryByText(/day run/)).not.toBeInTheDocument()
  })

  test('a broken streak shows no counter at all, never a zero', () => {
    render(<ContributionGrid rows={[on('2026-08-01')]} weeks={4} now={NOW} tz={NY} />)
    expect(screen.queryByText(/day run/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^0/)).not.toBeInTheDocument()
  })

  test('states the output-not-intake rule in the footer', () => {
    render(<ContributionGrid rows={[]} weeks={4} now={NOW} tz={NY} />)
    expect(screen.getByText(/Saving a link is not a contribution/)).toBeInTheDocument()
  })

  test('survives malformed rows rather than crashing the Manager', () => {
    const rows = [null, { day: 'nope' }, {}, on('2026-08-07')]
    const { container } = render(<ContributionGrid rows={rows} weeks={2} now={NOW} tz={NY} />)
    expect(squares(container)).toHaveLength(14)
    expect(screen.getByText('1 contribution · 1 day')).toBeInTheDocument()
  })
})
