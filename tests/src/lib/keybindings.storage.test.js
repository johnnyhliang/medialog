import { expect, test, vi, beforeEach, afterEach } from 'vitest'
import { saveBinding, resetBinding, resetAllBindings, loadOverrides } from '../../../src/lib/keybindings.js'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

// setItem/removeItem throw — they do not return null — in private-mode Safari
// and on a full quota. Rebinding a key is allowed to not survive a reload; it is
// not allowed to throw out of the settings handler that called it.
test('saveBinding does not throw when storage is unavailable', () => {
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(() => saveBinding('open-palette', 'Mod+k')).not.toThrow()
})

test('resetBinding does not throw when storage is unavailable', () => {
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(() => resetBinding('open-palette')).not.toThrow()
})

test('resetAllBindings does not throw when storage is unavailable', () => {
  vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new Error('denied') })
  expect(() => resetAllBindings()).not.toThrow()
})

test('bindings still round-trip when storage works', () => {
  saveBinding('open-palette', 'Mod+k')
  expect(loadOverrides()['open-palette']).toBe('Mod+k')
  resetBinding('open-palette')
  expect(loadOverrides()['open-palette']).toBeUndefined()
})
