import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useTopics } from './useTopics.js'

test('starts with empty topics and null selectedId', () => {
  const { result } = renderHook(() => useTopics())
  expect(result.current.topics).toEqual([])
  expect(result.current.selectedId).toBeNull()
  expect(result.current.inboxCount).toBe(0)
})

test('selectedTopic is null when no selectedId', () => {
  const { result } = renderHook(() => useTopics())
  expect(result.current.selectedTopic).toBeNull()
})

test('inboxTopic finds topic named Inbox', () => {
  const { result } = renderHook(() => useTopics())
  act(() => { result.current.setTopics([{ id: '1', name: 'Inbox' }, { id: '2', name: 'Books' }]) })
  expect(result.current.inboxTopic).toEqual({ id: '1', name: 'Inbox' })
})

test('applyAddTopic appends, sorts by name, and selects the new topic', () => {
  const { result } = renderHook(() => useTopics())
  act(() => { result.current.setTopics([{ id: '1', name: 'Zebra' }]) })
  act(() => { result.current.applyAddTopic({ id: '2', name: 'Apple' }) })
  expect(result.current.topics[0].name).toBe('Apple')
  expect(result.current.topics[1].name).toBe('Zebra')
  expect(result.current.selectedId).toBe('2')
})

test('applySelectTopic sets selectedId and updates selectedTopic', () => {
  const { result } = renderHook(() => useTopics())
  act(() => { result.current.setTopics([{ id: '1', name: 'Books' }]) })
  act(() => { result.current.applySelectTopic('1') })
  expect(result.current.selectedId).toBe('1')
  expect(result.current.selectedTopic).toEqual({ id: '1', name: 'Books' })
})
