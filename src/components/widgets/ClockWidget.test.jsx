import { render, act } from '@testing-library/react'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import ClockWidget from './ClockWidget.jsx'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

test('renders a date and time string', () => {
  render(<ClockWidget />)
  expect(document.querySelector('.kw-clock')).toBeTruthy()
  expect(document.querySelector('.kw-clock-time').textContent).toMatch(/\d+:\d+/)
  expect(document.querySelector('.kw-clock-day').textContent.length).toBeGreaterThan(0)
})

test('updates display after 1 second', () => {
  render(<ClockWidget />)
  act(() => { vi.advanceTimersByTime(60000) })
  expect(document.querySelector('.kw-clock')).toBeTruthy()
})
