import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeadlineAlertBanner from '../../../../src/components/widgets/DeadlineAlertBanner.jsx'

const NY = 'America/New_York'

// The component's only dependency is listDeadlines; the merge rules are covered
// by deadlines.test.js, so this mocks the read and tests the rendering.
vi.mock('../../../../src/lib/db/deadlines.js', () => ({
  listDeadlines: vi.fn(),
}))
const { listDeadlines } = await import('../../../../src/lib/db/deadlines.js')

const item = (over = {}) => ({
  key: 'application:a1', name: 'Optiver', url: null,
  daysLeft: 3, when: 'in 3 days', detail: 'Quant Dev Intern', ...over,
})

beforeEach(() => {
  localStorage.clear()
  listDeadlines.mockReset()
})

describe('DeadlineAlertBanner', () => {
  test('renders nothing when nothing is close — the healthy path costs no attention', async () => {
    listDeadlines.mockResolvedValue([])
    const { container } = render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    await waitFor(() => expect(listDeadlines).toHaveBeenCalled())
    expect(container.querySelector('.deadline-banner')).toBe(null)
  })

  test('renders nothing when the read fails, and never toasts', async () => {
    listDeadlines.mockRejectedValue(new Error('offline'))
    const { container } = render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    await waitFor(() => expect(listDeadlines).toHaveBeenCalled())
    expect(container.querySelector('.deadline-banner')).toBe(null)
  })

  test('shows the phrase, the name and the detail', async () => {
    listDeadlines.mockResolvedValue([item()])
    render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    expect(await screen.findByText('Optiver')).toBeInTheDocument()
    expect(screen.getByText('in 3 days')).toBeInTheDocument()
    expect(screen.getByText('Quant Dev Intern')).toBeInTheDocument()
  })

  test('grades the row by urgency', async () => {
    listDeadlines.mockResolvedValue([
      item({ key: 'a', daysLeft: 0, when: 'today' }),
      item({ key: 'b', daysLeft: 5, when: 'in 5 days' }),
      item({ key: 'c', daysLeft: 20, when: 'in 20 days' }),
      item({ key: 'd', daysLeft: null, when: 'open now' }),
    ])
    const { container } = render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    await screen.findByText('today')
    expect(container.querySelector('.deadline-row--today')).toBeTruthy()
    expect(container.querySelector('.deadline-row--soon')).toBeTruthy()
    expect(container.querySelector('.deadline-row--later')).toBeTruthy()
    expect(container.querySelector('.deadline-row--open')).toBeTruthy()
  })

  test('links out when there is a url, otherwise opens career', async () => {
    const onOpenCareer = vi.fn()
    listDeadlines.mockResolvedValue([
      item({ key: 'a', name: 'Neo', url: 'https://neo.com' }),
      item({ key: 'b', name: 'Optiver', url: null }),
    ])
    render(<DeadlineAlertBanner supabase={{}} timezone={NY} onOpenCareer={onOpenCareer} />)
    const link = await screen.findByRole('link', { name: 'Neo' })
    expect(link).toHaveAttribute('href', 'https://neo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Optiver' }))
    expect(onOpenCareer).toHaveBeenCalled()
  })

  test('dismissing hides the row and persists across a remount', async () => {
    listDeadlines.mockResolvedValue([item()])
    const { unmount } = render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    await screen.findByText('Optiver')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss Optiver' }))
    expect(screen.queryByText('Optiver')).not.toBeInTheDocument()

    unmount()
    render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    await waitFor(() => expect(listDeadlines).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Optiver')).not.toBeInTheDocument()
  })

  test('dismissing one leaves the others', async () => {
    listDeadlines.mockResolvedValue([item({ key: 'a', name: 'Optiver' }), item({ key: 'b', name: 'Neo' })])
    render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    await screen.findByText('Optiver')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss Optiver' }))
    expect(screen.queryByText('Optiver')).not.toBeInTheDocument()
    expect(screen.getByText('Neo')).toBeInTheDocument()
  })

  test('a corrupt dismiss list does not break the banner', async () => {
    localStorage.setItem('medialog_dismissed_deadlines', '{not json')
    listDeadlines.mockResolvedValue([item()])
    render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    expect(await screen.findByText('Optiver')).toBeInTheDocument()
  })

  test('the horizon note appears only with more than one row', async () => {
    listDeadlines.mockResolvedValue([item()])
    const { rerender } = render(<DeadlineAlertBanner supabase={{}} timezone={NY} />)
    await screen.findByText('Optiver')
    expect(screen.queryByText(/Within 28 days/)).not.toBeInTheDocument()

    listDeadlines.mockResolvedValue([item({ key: 'a' }), item({ key: 'b', name: 'Neo' })])
    rerender(<DeadlineAlertBanner supabase={{}} timezone={NY} key="2" />)
    expect(await screen.findByText(/Within 28 days/)).toBeInTheDocument()
  })
})
