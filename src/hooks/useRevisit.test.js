import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useRevisit } from './useRevisit.js'

const ENTRIES = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }]

test('starts empty', () => {
  const { result } = renderHook(() => useRevisit())
  expect(result.current.revisitEntries).toEqual([])
  expect(result.current.recentActivity).toEqual([])
})

test('applySeen removes entry from revisitEntries', () => {
  const { result } = renderHook(() => useRevisit())
  act(() => { result.current.setRevisitEntries(ENTRIES) })
  act(() => { result.current.applySeen('1') })
  expect(result.current.revisitEntries).toHaveLength(1)
  expect(result.current.revisitEntries[0].id).toBe('2')
})

test('setRecentActivity stores activity', () => {
  const { result } = renderHook(() => useRevisit())
  act(() => { result.current.setRecentActivity([{ id: 'r1' }]) })
  expect(result.current.recentActivity).toHaveLength(1)
})
