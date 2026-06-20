import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import QuickLinksWidget from './QuickLinksWidget.jsx'

test('renders gmail, calendar, and brew links opening in new tab', () => {
  render(<QuickLinksWidget />)
  const gmail = screen.getByText('gmail').closest('a')
  const cal   = screen.getByText('calendar').closest('a')
  const brew  = screen.getByText('morning brew').closest('a')
  expect(gmail.href).toContain('mail.google.com')
  expect(cal.href).toContain('calendar.google.com')
  expect(brew.href).toContain('morningbrew.com')
  expect(gmail.target).toBe('_blank')
})
