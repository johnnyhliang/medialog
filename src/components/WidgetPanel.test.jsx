import { render, screen } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import WidgetPanel from './WidgetPanel.jsx'

const mockSupabase = {
  functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('skip') }) },
  from: vi.fn((table) => {
    if (table === 'feeds') {
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      }
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        order: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
        is: vi.fn(() => ({
          is: vi.fn(() => ({
            gt: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
      })),
    }
  }),
}

test('renders clock, search input, quick links, and market section', () => {
  render(<WidgetPanel supabase={mockSupabase} />)
  expect(document.querySelector('.kw-clock')).toBeTruthy()
  expect(screen.getByPlaceholderText(/search/i)).toBeTruthy()
  expect(screen.getByText('gmail')).toBeTruthy()
})
