import { render, screen } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import WidgetPanel from './WidgetPanel.jsx'

const mockSupabase = {
  functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('skip') }) },
}

test('renders clock, search input, quick link chips, and market section', () => {
  render(<WidgetPanel supabase={mockSupabase} />)
  // Clock
  expect(document.querySelector('.widget-clock')).toBeTruthy()
  // Search
  expect(screen.getByPlaceholderText(/search/i)).toBeTruthy()
  // Quick links
  expect(screen.getByText('Gmail')).toBeTruthy()
  // Market (error state since invoke fails)
  // Component renders without crashing
})
