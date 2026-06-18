import { renderHook, act } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import useToast from './useToast.js'

test('starts with empty toasts', () => {
  const { result } = renderHook(() => useToast())
  expect(result.current.toasts).toHaveLength(0)
})

test('addToast adds a toast with id, message, type', () => {
  const { result } = renderHook(() => useToast())
  act(() => { result.current.addToast('Backup complete', 'success') })
  expect(result.current.toasts).toHaveLength(1)
  expect(result.current.toasts[0].message).toBe('Backup complete')
  expect(result.current.toasts[0].type).toBe('success')
  expect(result.current.toasts[0].id).toBeDefined()
})

test('dismissToast removes the toast', () => {
  const { result } = renderHook(() => useToast())
  act(() => { result.current.addToast('hello', 'info') })
  const id = result.current.toasts[0].id
  act(() => { result.current.dismissToast(id) })
  expect(result.current.toasts).toHaveLength(0)
})
