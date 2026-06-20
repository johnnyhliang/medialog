import { render, screen } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import WidgetPanel from './WidgetPanel.jsx'

const mockSupabase = {
  functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('skip') }) },
}

test('renders clock, search input, quick links, and market section', () => {
  render(<WidgetPanel supabase={mockSupabase} />)
  expect(document.querySelector('.kw-clock')).toBeTruthy()
  expect(screen.getByPlaceholderText(/search/i)).toBeTruthy()
  expect(screen.getByText('gmail')).toBeTruthy()
})
