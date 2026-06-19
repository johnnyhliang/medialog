import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useVersions } from './useVersions.js'

test('starts with null historyFor and empty versions', () => {
  const { result } = renderHook(() => useVersions())
  expect(result.current.historyFor).toBeNull()
  expect(result.current.versions).toEqual([])
})

test('openHistory sets historyFor and versions', () => {
  const { result } = renderHook(() => useVersions())
  act(() => { result.current.openHistory('entry-1', [{ id: 'v1', note: 'hello' }]) })
  expect(result.current.historyFor).toBe('entry-1')
  expect(result.current.versions).toHaveLength(1)
})

test('closeHistory sets historyFor to null', () => {
  const { result } = renderHook(() => useVersions())
  act(() => { result.current.openHistory('entry-1', []) })
  act(() => { result.current.closeHistory() })
  expect(result.current.historyFor).toBeNull()
})
