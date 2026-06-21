import { renderHook, act } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
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

const active = { id: '1', name: 'AI', archived_at: null }
const archived = { id: '2', name: 'Old', archived_at: '2026-01-01' }

test('activeTopics excludes archived topics (keeps Inbox regardless)', () => {
  const { result } = renderHook(() => useTopics())
  act(() => result.current.setTopics([active, archived]))
  expect(result.current.activeTopics.map(t => t.id)).toEqual(['1'])
})

test('archivedTopics includes only archived non-inbox topics', () => {
  const { result } = renderHook(() => useTopics())
  act(() => result.current.setTopics([active, archived]))
  expect(result.current.archivedTopics.map(t => t.id)).toEqual(['2'])
})

test('applyArchiveTopic updates the topic in state', () => {
  const { result } = renderHook(() => useTopics())
  act(() => result.current.setTopics([active]))
  const updated = { ...active, archived_at: '2026-06-20' }
  act(() => result.current.applyArchiveTopic('1', updated))
  expect(result.current.archivedTopics[0].id).toBe('1')
})

test('applyDeleteTopic removes topic from state', () => {
  const { result } = renderHook(() => useTopics())
  act(() => result.current.setTopics([active]))
  act(() => result.current.applyDeleteTopic('1'))
  expect(result.current.topics).toHaveLength(0)
})

test('applyRestoreDeletedTopic adds topic back sorted', () => {
  const { result } = renderHook(() => useTopics())
  act(() => result.current.setTopics([{ id: '3', name: 'Zebra', archived_at: null }]))
  act(() => result.current.applyRestoreDeletedTopic({ id: '1', name: 'AI', archived_at: null, deleted_at: null }))
  expect(result.current.topics[0].name).toBe('AI')
})

