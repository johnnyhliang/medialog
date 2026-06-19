import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { usePendingArchive } from './usePendingArchive.js'

test('starts with empty set', () => {
  const { result } = renderHook(() => usePendingArchive(null))
  expect(result.current.pendingArchiveIds.size).toBe(0)
})

test('addPending adds id to set', () => {
  const { result } = renderHook(() => usePendingArchive('topic-1'))
  act(() => { result.current.addPending('entry-1') })
  expect(result.current.pendingArchiveIds.has('entry-1')).toBe(true)
})

test('removePending removes id from set', () => {
  const { result } = renderHook(() => usePendingArchive('topic-1'))
  act(() => { result.current.addPending('entry-1') })
  act(() => { result.current.removePending('entry-1') })
  expect(result.current.pendingArchiveIds.has('entry-1')).toBe(false)
})

test('clears set when selectedId changes', () => {
  let selectedId = 'topic-1'
  const { result, rerender } = renderHook(() => usePendingArchive(selectedId))
  act(() => { result.current.addPending('entry-1') })
  expect(result.current.pendingArchiveIds.size).toBe(1)
  selectedId = 'topic-2'
  rerender()
  expect(result.current.pendingArchiveIds.size).toBe(0)
})
