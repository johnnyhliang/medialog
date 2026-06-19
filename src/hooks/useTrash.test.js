import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useTrash } from './useTrash.js'

const ENTRIES = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }]

test('starts empty', () => {
  const { result } = renderHook(() => useTrash())
  expect(result.current.trashEntries).toEqual([])
})

test('applyRestore removes entry', () => {
  const { result } = renderHook(() => useTrash())
  act(() => { result.current.setTrashEntries(ENTRIES) })
  act(() => { result.current.applyRestore('1') })
  expect(result.current.trashEntries).toHaveLength(1)
  expect(result.current.trashEntries[0].id).toBe('2')
})

test('applyClear empties the list', () => {
  const { result } = renderHook(() => useTrash())
  act(() => { result.current.setTrashEntries(ENTRIES) })
  act(() => { result.current.applyClear() })
  expect(result.current.trashEntries).toEqual([])
})
