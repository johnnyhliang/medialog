import { renderHook, act } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useTags } from './useTags.js'

const TAGS = [
  { id: '1', name: 'fiction', color: '#ff0000' },
  { id: '2', name: 'tech', color: null },
]

test('starts with empty tags and empty tagColors', () => {
  const { result } = renderHook(() => useTags())
  expect(result.current.allTags).toEqual([])
  expect(result.current.tagColors).toEqual({})
})

test('tagColors only includes tags with a color', () => {
  const { result } = renderHook(() => useTags())
  act(() => { result.current.setAllTags(TAGS) })
  expect(result.current.tagColors).toEqual({ fiction: '#ff0000' })
})

test('applyUpdateTagColor updates color for named tag', () => {
  const { result } = renderHook(() => useTags())
  act(() => { result.current.setAllTags(TAGS) })
  act(() => { result.current.applyUpdateTagColor('tech', '#00ff00') })
  expect(result.current.allTags.find(t => t.name === 'tech').color).toBe('#00ff00')
  expect(result.current.tagColors['tech']).toBe('#00ff00')
})

test('applyUpdateTagColor with empty string sets color to null', () => {
  const { result } = renderHook(() => useTags())
  act(() => { result.current.setAllTags(TAGS) })
  act(() => { result.current.applyUpdateTagColor('fiction', '') })
  expect(result.current.allTags.find(t => t.name === 'fiction').color).toBeNull()
})
