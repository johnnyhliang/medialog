import { render, screen, waitFor } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
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
  trending:  [{ ticker: 'NVDA', mentions: 1204, mentionsDelta: 89 }],
  headlines: [{ title: 'Fed holds rates steady', url: 'https://reuters.com/1', source: 'Reuters' }],
}

test('shows loading state initially', () => {
  render(<MarketNewsWidget supabase={makeSupabase(mockData)} />)
  expect(screen.getByText(/loading/i)).toBeTruthy()
})

test('renders market quotes after load', async () => {
  render(<MarketNewsWidget supabase={makeSupabase(mockData)} />)
  await waitFor(() => expect(screen.getByText('VOO')).toBeTruthy())
  expect(screen.getByText('$541.23')).toBeTruthy()
  expect(screen.getByText('+0.39%')).toBeTruthy()
})

test('renders WSB trending section', async () => {
  render(<MarketNewsWidget supabase={makeSupabase(mockData)} />)
  await waitFor(() => expect(screen.getByText('NVDA')).toBeTruthy())
  expect(screen.getByText(/1,?204 mentions/)).toBeTruthy()
})

test('renders headlines section', async () => {
  render(<MarketNewsWidget supabase={makeSupabase(mockData)} />)
  await waitFor(() => expect(screen.getByText('Fed holds rates steady')).toBeTruthy())
})

test('shows "unavailable" when edge function errors', async () => {
  const supabase = {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('fail') }) },
  }
  render(<MarketNewsWidget supabase={supabase} />)
  await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeTruthy())
})
