import { render, screen, act } from '@testing-library/react'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import useCurrentTime, { minutesSince } from '../../../src/hooks/useCurrentTime.js'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function Clock({ intervalMs }) {
  const now = useCurrentTime(intervalMs)
  return <span data-testid="now">{now}</span>
}

test('holds the clock in state so a render is not a fresh Date.now()', () => {
  const start = new Date('2026-08-31T12:00:00Z').getTime()
  vi.setSystemTime(start)
  const { rerender } = render(<Clock />)
  const first = screen.getByTestId('now').textContent

  // Time passes, but nothing ticked: re-rendering must not change the reading.
  vi.setSystemTime(start + 30_000)
  rerender(<Clock />)
  expect(screen.getByTestId('now').textContent).toBe(first)

  act(() => { vi.advanceTimersByTime(60_000) })
  expect(Number(screen.getByTestId('now').textContent)).toBe(start + 90_000)
})

test('the default interval is one minute, matching the displayed unit', () => {
  const start = Date.now()
  vi.setSystemTime(start)
  render(<Clock />)
  act(() => { vi.advanceTimersByTime(59_000) })
  expect(Number(screen.getByTestId('now').textContent)).toBe(start)
  act(() => { vi.advanceTimersByTime(1_000) })
  expect(Number(screen.getByTestId('now').textContent)).toBe(start + 60_000)
})

test('the interval is cleared on unmount', () => {
  const clear = vi.spyOn(globalThis, 'clearInterval')
  const { unmount } = render(<Clock />)
  unmount()
  expect(clear).toHaveBeenCalled()
})

test('minutesSince clamps future timestamps and passes null through', () => {
  const now = Date.now()
  expect(minutesSince(null, now)).toBe(null)
  expect(minutesSince(new Date(now - 125_000), now)).toBe(2)
  expect(minutesSince(new Date(now + 600_000), now)).toBe(0)
})
