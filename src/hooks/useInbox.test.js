import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useInbox } from './useInbox.js'

const ENTRIES = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }]

test('starts empty', () => {
  const { result } = renderHook(() => useInbox())
  expect(result.current.inboxEntries).toEqual([])
})

test('applyAssign removes entry', () => {
  const { result } = renderHook(() => useInbox())
  act(() => { result.current.setInboxEntries(ENTRIES) })
  act(() => { result.current.applyAssign('1') })
  expect(result.current.inboxEntries).toHaveLength(1)
  expect(result.current.inboxEntries[0].id).toBe('2')
})

test('applySortDelete removes entry', () => {
  const { result } = renderHook(() => useInbox())
  act(() => { result.current.setInboxEntries(ENTRIES) })
  act(() => { result.current.applySortDelete('2') })
  expect(result.current.inboxEntries).toHaveLength(1)
  expect(result.current.inboxEntries[0].id).toBe('1')
})
