import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useExport } from './useExport.js'

test('starts with null exportModal', () => {
  const { result } = renderHook(() => useExport())
  expect(result.current.exportModal).toBeNull()
})

test('openExportLoading sets loading state', () => {
  const { result } = renderHook(() => useExport())
  act(() => { result.current.openExportLoading() })
  expect(result.current.exportModal).toEqual({ estimatedKB: null, entryCount: null, loading: true })
})

test('setExportResult sets result with loading false', () => {
  const { result } = renderHook(() => useExport())
  act(() => { result.current.openExportLoading() })
  act(() => { result.current.setExportResult(42, 100) })
  expect(result.current.exportModal).toEqual({ estimatedKB: 42, entryCount: 100, loading: false })
})

test('closeExportModal resets to null', () => {
  const { result } = renderHook(() => useExport())
  act(() => { result.current.openExportLoading() })
  act(() => { result.current.closeExportModal() })
  expect(result.current.exportModal).toBeNull()
})
