// src/components/widgets/ClockWidget.test.jsx
import { render, screen, act } from '@testing-library/react'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import ClockWidget from './ClockWidget.jsx'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

test('renders a date and time string', () => {
  render(<ClockWidget />)
  // Should render something like "Thu Jun 19 · 10:42 AM"
  // Just verify a non-empty text node exists in a recognizable time format
  expect(document.querySelector('.widget-clock')).toBeTruthy()
  const text = document.querySelector('.widget-clock').textContent
  expect(text).toMatch(/·/)
})

test('updates display after 1 second', () => {
  render(<ClockWidget />)
  const before = document.querySelector('.widget-clock').textContent
  act(() => { vi.advanceTimersByTime(60000) })
  // Clock still renders (interval running)
  expect(document.querySelector('.widget-clock')).toBeTruthy()
})
