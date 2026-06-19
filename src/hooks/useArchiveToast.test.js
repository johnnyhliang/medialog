import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useArchiveToast } from './useArchiveToast.js'

test('defaults to true', () => {
  const { result } = renderHook(() => useArchiveToast())
  expect(result.current.archiveToast).toBe(true)
})

test('setArchiveToast updates value', () => {
  const { result } = renderHook(() => useArchiveToast())
  act(() => { result.current.setArchiveToast(false) })
  expect(result.current.archiveToast).toBe(false)
})
