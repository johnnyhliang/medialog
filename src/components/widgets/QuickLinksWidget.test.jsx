// src/components/widgets/QuickLinksWidget.test.jsx
import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import QuickLinksWidget from './QuickLinksWidget.jsx'

test('renders Gmail, Calendar, and Brew links opening in new tab', () => {
  render(<QuickLinksWidget />)
  const gmail = screen.getByText('Gmail').closest('a')
  const cal   = screen.getByText('Calendar').closest('a')
  const brew  = screen.getByText('Brew').closest('a')
  expect(gmail.href).toContain('mail.google.com')
  expect(cal.href).toContain('calendar.google.com')
  expect(brew.href).toContain('morningbrew.com')
  expect(gmail.target).toBe('_blank')
})
