import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme.js'

const makeSupabase = (dbTheme = null) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: dbTheme ? { id: 'u1' } : null },
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: dbTheme ? { theme: dbTheme } : null,
    }),
  }),
})

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.style
})

describe('useTheme', () => {
  it('defaults to warm/default when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.palette).toBe('warm')
    expect(result.current.style).toBe('default')
    expect(document.documentElement.dataset.theme).toBe('warm')
    expect(document.documentElement.dataset.style).toBe('default')
  })

  it('reads from localStorage on mount', () => {
    localStorage.setItem('ml_theme', JSON.stringify({ palette: 'nord', style: 'brutalist' }))
    const { result } = renderHook(() => useTheme())
    expect(result.current.palette).toBe('nord')
    expect(result.current.style).toBe('brutalist')
    expect(document.documentElement.dataset.theme).toBe('nord')
    expect(document.documentElement.dataset.style).toBe('brutalist')
  })

  it('ignores corrupt localStorage and falls back to default', () => {
    localStorage.setItem('ml_theme', 'not-json')
    const { result } = renderHook(() => useTheme())
    expect(result.current.palette).toBe('warm')
  })

  it('ignores invalid palette/style values in localStorage', () => {
    localStorage.setItem('ml_theme', JSON.stringify({ palette: 'evil', style: 'hax' }))
    const { result } = renderHook(() => useTheme())
    expect(result.current.palette).toBe('warm')
    expect(result.current.style).toBe('default')
  })

  it('setPalette updates state, html attribute, and localStorage', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setPalette('catppuccin-mocha'))
    expect(result.current.palette).toBe('catppuccin-mocha')
    expect(document.documentElement.dataset.theme).toBe('catppuccin-mocha')
    expect(JSON.parse(localStorage.getItem('ml_theme')).palette).toBe('catppuccin-mocha')
  })

  it('setStyle updates state, html attribute, and localStorage', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setStyle('glass'))
    expect(result.current.style).toBe('glass')
    expect(document.documentElement.dataset.style).toBe('glass')
    expect(JSON.parse(localStorage.getItem('ml_theme')).style).toBe('glass')
  })

  it('setPalette ignores invalid palette ids', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setPalette('invalid'))
    expect(result.current.palette).toBe('warm')
  })
})
