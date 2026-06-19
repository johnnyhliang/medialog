import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useEntries } from './useEntries.js'

const ENTRIES = [
  { id: '1', title: 'A', tags: ['x'], status: 'backlog' },
  { id: '2', title: 'B', tags: ['y'], status: 'active' },
]

test('starts with empty entries and null search results', () => {
  const { result } = renderHook(() => useEntries())
  expect(result.current.entries).toEqual([])
  expect(result.current.globalSearchResults).toBeNull()
})

test('applyUpdateEntry replaces entry and preserves existing tags', () => {
  const { result } = renderHook(() => useEntries())
  act(() => { result.current.setEntries(ENTRIES) })
  act(() => { result.current.applyUpdateEntry('1', { id: '1', title: 'A-updated', tags: [], status: 'done' }) })
  const updated = result.current.entries.find(e => e.id === '1')
  expect(updated.title).toBe('A-updated')
  expect(updated.tags).toEqual(['x']) // preserved from original, not from updated
})

test('applyDeleteEntry removes entry by id', () => {
  const { result } = renderHook(() => useEntries())
  act(() => { result.current.setEntries(ENTRIES) })
  act(() => { result.current.applyDeleteEntry('1') })
  expect(result.current.entries).toHaveLength(1)
  expect(result.current.entries[0].id).toBe('2')
})

test('applyMoveEntry removes entry from list', () => {
  const { result } = renderHook(() => useEntries())
  act(() => { result.current.setEntries(ENTRIES) })
  act(() => { result.current.applyMoveEntry('2') })
  expect(result.current.entries).toHaveLength(1)
  expect(result.current.entries[0].id).toBe('1')
})

test('setGlobalSearchResults stores results', () => {
  const { result } = renderHook(() => useEntries())
  act(() => { result.current.setGlobalSearchResults([{ id: '3', title: 'C' }]) })
  expect(result.current.globalSearchResults).toHaveLength(1)
})
