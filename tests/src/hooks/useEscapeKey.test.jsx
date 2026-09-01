import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useEscapeKey } from '../../../src/hooks/useEscapeKey.js'

function Harness({ onEscape, enabled }) {
  useEscapeKey(onEscape, enabled)
  return <div>harness</div>
}

function pressEscape() {
  fireEvent.keyDown(window, { key: 'Escape' })
}

describe('useEscapeKey', () => {
  it('calls the handler when Escape is pressed', () => {
    const onEscape = vi.fn()
    render(<Harness onEscape={onEscape} />)
    pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('ignores every other key', () => {
    const onEscape = vi.fn()
    render(<Harness onEscape={onEscape} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'e' })
    fireEvent.keyDown(window, { key: 'Esc' }) // the old IE name, not what we match
    expect(onEscape).not.toHaveBeenCalled()
  })

  // The classic failure of this extraction: the listener outlives the component
  // and keeps closing something that is already gone.
  it('unbinds on unmount', () => {
    const onEscape = vi.fn()
    const { unmount } = render(<Harness onEscape={onEscape} />)
    unmount()
    pressEscape()
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('leaves no listener behind after unmount', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<Harness onEscape={() => {}} />)
    unmount()
    const added = add.mock.calls.filter(([type]) => type === 'keydown')
    const removed = remove.mock.calls.filter(([type]) => type === 'keydown')
    expect(added).toHaveLength(1)
    expect(removed).toHaveLength(1)
    // Same function reference, or removeEventListener silently does nothing.
    expect(removed[0][1]).toBe(added[0][1])
    add.mockRestore()
    remove.mockRestore()
  })

  it('binds nothing while disabled, and starts working when enabled', () => {
    const onEscape = vi.fn()
    const { rerender } = render(<Harness onEscape={onEscape} enabled={false} />)
    pressEscape()
    expect(onEscape).not.toHaveBeenCalled()

    rerender(<Harness onEscape={onEscape} enabled />)
    pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)

    // ...and stops again when it closes.
    rerender(<Harness onEscape={onEscape} enabled={false} />)
    pressEscape()
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('calls the latest handler after it changes, not a stale closure', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Harness onEscape={first} />)
    rerender(<Harness onEscape={second} />)
    pressEscape()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
