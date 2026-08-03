import { renderHook, act } from '@testing-library/react'
import { expect, test, beforeEach } from 'vitest'
import { useArchiveToast } from '../../../src/hooks/useArchiveToast.js'

beforeEach(() => localStorage.clear())

test('defaults to true', () => {
  const { result } = renderHook(() => useArchiveToast())
  expect(result.current.archiveToast).toBe(true)
})

test('setArchiveToast updates value', () => {
  const { result } = renderHook(() => useArchiveToast())
  act(() => { result.current.setArchiveToast(false) })
  expect(result.current.archiveToast).toBe(false)
})

// The two tests above pass whether or not the value is persisted, because neither
// remounts the hook. That is precisely how this shipped unpersisted: the setting
// worked perfectly until you reloaded, and nothing in the suite ever reloaded.
test('the setting survives a remount', () => {
  const first = renderHook(() => useArchiveToast())
  act(() => { first.result.current.setArchiveToast(false) })
  first.unmount()

  const second = renderHook(() => useArchiveToast())
  expect(second.result.current.archiveToast).toBe(false)
})

test('turning it back on survives a remount too', () => {
  const first = renderHook(() => useArchiveToast())
  act(() => { first.result.current.setArchiveToast(false) })
  act(() => { first.result.current.setArchiveToast(true) })
  first.unmount()

  expect(renderHook(() => useArchiveToast()).result.current.archiveToast).toBe(true)
})

test('a never-set preference takes the default rather than reading as off', () => {
  // 'absent' and 'false' must not collapse into the same thing — otherwise every
  // new account starts with the toast silently disabled.
  expect(localStorage.getItem('medialog_archive_toast')).toBeNull()
  expect(renderHook(() => useArchiveToast()).result.current.archiveToast).toBe(true)
})
