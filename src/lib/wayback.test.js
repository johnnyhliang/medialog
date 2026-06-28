import { vi, test, expect, beforeEach } from 'vitest'
import { checkArchive, submitArchive } from './wayback.js'

beforeEach(() => { vi.restoreAllMocks() })

test('checkArchive returns archived=true with ISO timestamp when snapshot exists', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      archived_snapshots: {
        closest: {
          available: true,
          timestamp: '20240315102200',
          url: 'https://web.archive.org/web/20240315102200/https://example.com',
        },
      },
    }),
  }))

  const result = await checkArchive('https://example.com')

  expect(result.archived).toBe(true)
  expect(result.timestamp).toBe('2024-03-15T10:22:00.000Z')
  expect(result.snapshotUrl).toBe('https://web.archive.org/web/20240315102200/https://example.com')
})

test('checkArchive returns archived=false when no snapshot', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ archived_snapshots: {} }),
  }))

  const result = await checkArchive('https://example.com')

  expect(result.archived).toBe(false)
  expect(result.timestamp).toBeNull()
  expect(result.snapshotUrl).toBeNull()
})

test('checkArchive throws when fetch fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
  await expect(checkArchive('https://example.com')).rejects.toThrow('network error')
})

test('checkArchive throws on non-2xx response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: 503,
  }))

  await expect(checkArchive('https://example.com')).rejects.toThrow('503')
})

test('submitArchive opens archive.org save URL in new tab', () => {
  const openSpy = vi.fn()
  vi.stubGlobal('window', { open: openSpy })

  submitArchive('https://example.com')

  expect(openSpy).toHaveBeenCalledWith(
    'https://web.archive.org/save/https://example.com',
    '_blank',
    'noopener,noreferrer'
  )
})
