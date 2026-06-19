// src/components/widgets/MarketNewsWidget.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import MarketNewsWidget from './MarketNewsWidget.jsx'

function makeSupabase(data) {
  return {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data, error: null }),
    },
  }
}

const mockData = {
  quotes:    [{ ticker: 'VOO', price: 541.23, change: 2.1, changePercent: 0.39 }],
  gainers:   [{ ticker: 'NVDA', changePercent: 8.2 }],
  losers:    [{ ticker: 'INTC', changePercent: -4.3 }],
  trending:  [{ ticker: 'NVDA', mentions: 1204, mentionsDelta: 89 }],
  headlines: [{ title: 'Fed holds rates steady', url: 'https://reuters.com/1' }],
}

test('shows loading state initially', () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  expect(screen.getByText(/loading/i)).toBeTruthy()
})

test('renders market quotes after load', async () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getByText('VOO')).toBeTruthy())
  expect(screen.getByText('$541.23')).toBeTruthy()
})

test('renders movers section', async () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getByText('NVDA')).toBeTruthy())
  expect(screen.getByText(/8\.2%/)).toBeTruthy()
})

test('renders WSB trending section', async () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0))
  expect(screen.getByText(/1,?204/)).toBeTruthy()
})

test('renders headlines section', async () => {
  const supabase = makeSupabase(mockData)
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getByText('Fed holds rates steady')).toBeTruthy())
})

test('shows "unavailable" when edge function errors', async () => {
  const supabase = {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('fail') }) },
  }
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeTruthy())
})
