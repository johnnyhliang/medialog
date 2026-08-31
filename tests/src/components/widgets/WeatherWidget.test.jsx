import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import WeatherWidget from '../../../../src/components/widgets/WeatherWidget.jsx'

beforeEach(() => {
  localStorage.clear()
  global.fetch = vi.fn((url) => {
    if (String(url).includes('geocoding-api')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ results: [{ name: 'Ann Arbor', admin1: 'MI', latitude: 42.3, longitude: -83.7 }] }),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ current: { temperature_2m: 70, apparent_temperature: 68, windspeed_10m: 5, weathercode: 0 } }),
    })
  })
})
afterEach(() => vi.restoreAllMocks())

// setItem throws in private-mode Safari and on a full quota. The write sat
// inside the geocode try block, so a storage failure was reported to the user as
// "not found" for a city that had resolved perfectly well — and the location
// never got applied at all.
test('a city that resolves is applied even when localStorage throws', async () => {
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  render(<WeatherWidget />)
  await userEvent.click(await screen.findByText('Troy, MI'))
  await userEvent.type(screen.getByPlaceholderText('city, state…'), 'Ann Arbor')
  await userEvent.click(screen.getByText('set'))
  await waitFor(() => expect(screen.getByText('Ann Arbor, MI')).toBeInTheDocument())
  expect(screen.queryByText('not found')).toBeNull()
})
