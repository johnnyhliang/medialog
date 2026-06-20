import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import SearchWidget from './SearchWidget.jsx'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('open', vi.fn())
})

test('renders search input and three engine buttons', () => {
  render(<SearchWidget />)
  expect(screen.getByPlaceholderText(/search/i)).toBeTruthy()
  expect(screen.getByText('google')).toBeTruthy()
  expect(screen.getByText('ddg')).toBeTruthy()
  expect(screen.getByText('kagi')).toBeTruthy()
})

test('pressing Enter opens search in new tab with default engine (google)', async () => {
  render(<SearchWidget />)
  const input = screen.getByPlaceholderText(/search/i)
  await userEvent.type(input, 'react hooks{Enter}')
  expect(window.open).toHaveBeenCalledWith(
    expect.stringContaining('google.com/search'),
    '_blank'
  )
})

test('switching engine persists to localStorage', async () => {
  render(<SearchWidget />)
  await userEvent.click(screen.getByText('ddg'))
  expect(localStorage.getItem('medialog_search_engine')).toBe('DDG')
})

test('selected engine is highlighted with active class', async () => {
  render(<SearchWidget />)
  const ddg = screen.getByText('ddg')
  await userEvent.click(ddg)
  expect(ddg.className).toContain('active')
})
