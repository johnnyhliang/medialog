import { expect, test, beforeEach, vi, afterEach } from 'vitest'
import { readPref, writePref, readBoolPref } from '../../../src/lib/localPref.js'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

test('round-trips a value', () => {
  writePref('k', 'behavior')
  expect(readPref('k', 'appearance')).toBe('behavior')
})

test('missing key returns the fallback', () => {
  expect(readPref('nope', 'appearance')).toBe('appearance')
})

test('booleans round-trip in both directions', () => {
  writePref('b', false)
  expect(readBoolPref('b', true)).toBe(false)
  writePref('b', true)
  expect(readBoolPref('b', true)).toBe(true)
})

test('an unset boolean takes the caller default, not false', () => {
  expect(readBoolPref('unset', true)).toBe(true)
  expect(readBoolPref('unset', false)).toBe(false)
})

// Private-mode Safari and a full quota make localStorage *throw* rather than
// return null. A preference read must never be the thing that stops the app
// rendering, and a preference write must never fail the action it accompanies.
test('a throwing localStorage falls back instead of propagating', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  expect(readPref('k', 'appearance')).toBe('appearance')
  expect(readBoolPref('k', true)).toBe(true)
})

test('a throwing write is swallowed', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(() => writePref('k', 'v')).not.toThrow()
})
