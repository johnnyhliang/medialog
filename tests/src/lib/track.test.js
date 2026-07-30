import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { track, flushEvents } from '../../../src/lib/track.js'

function fakeClient() {
  const insert = vi.fn(() => Promise.resolve({ error: null }))
  return { insert, from: vi.fn(() => ({ insert })) }
}

describe('track', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(async () => {
    vi.useRealTimers()
    await flushEvents()
  })

  it('no-ops without a client so tests and the landing page need no mocks', async () => {
    expect(() => track(null, 'digest_opened')).not.toThrow()
    await flushEvents()
  })

  it('does not insert until the flush timer fires', async () => {
    const sb = fakeClient()
    track(sb, 'digest_opened')
    expect(sb.from).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(3000)
    expect(sb.from).toHaveBeenCalledWith('events')
    expect(sb.insert).toHaveBeenCalledTimes(1)
  })

  it('batches a burst of 200 events into a handful of inserts, not 200', async () => {
    const sb = fakeClient()
    for (let i = 0; i < 200; i++) track(sb, 'entry_created', { source: 'bulk' })
    await vi.advanceTimersByTimeAsync(3000)
    expect(sb.insert.mock.calls.length).toBeLessThanOrEqual(3)
    const total = sb.insert.mock.calls.reduce((n, [rows]) => n + rows.length, 0)
    expect(total).toBe(200)
  })

  it('never rejects when the client throws', async () => {
    const sb = { from: () => { throw new Error('network down') } }
    track(sb, 'search_run', { mode: 'keyword' })
    await expect(flushEvents()).resolves.toBeUndefined()
  })

  it('never rejects when the insert rejects', async () => {
    const insert = vi.fn(() => Promise.reject(new Error('rls')))
    track({ from: () => ({ insert }) }, 'topic_created')
    await expect(flushEvents()).resolves.toBeUndefined()
  })

  it('drops unknown event names', async () => {
    const sb = fakeClient()
    track(sb, 'note_read', { text: 'secret' })
    await vi.advanceTimersByTimeAsync(3000)
    expect(sb.insert).not.toHaveBeenCalled()
  })

  it('flushes buffered events when the tab is hidden', async () => {
    const sb = fakeClient()
    track(sb, 'digest_opened')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(sb.insert).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })
})
