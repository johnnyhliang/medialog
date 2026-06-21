import { describe, test, expect, vi } from 'vitest'
import { isAllowedAttachment, markdownForAttachment, getUserUsageBytes, uploadAttachment } from './storage.js'

describe('isAllowedAttachment', () => {
  test('accepts images and PDFs under limit', () => {
    expect(isAllowedAttachment({ type: 'image/png', size: 1000 })).toBe(true)
    expect(isAllowedAttachment({ type: 'application/pdf', size: 1000 })).toBe(true)
  })

  test('rejects oversized or unknown types', () => {
    expect(isAllowedAttachment({ type: 'image/png', size: 11 * 1024 * 1024 })).toBe(false)
    expect(isAllowedAttachment({ type: 'text/plain', size: 100 })).toBe(false)
  })
})

describe('markdownForAttachment', () => {
  test('images become markdown images (no thumb)', () => {
    expect(markdownForAttachment('https://x/img.png', null, { name: 'shot.png', type: 'image/png' }))
      .toBe('![shot.png](https://x/img.png)')
  })

  test('images with thumbUrl become linked images', () => {
    expect(markdownForAttachment('https://x/img.png', 'https://x/img.thumb.webp', { name: 'shot.png', type: 'image/png' }))
      .toBe('[![shot.png](https://x/img.thumb.webp)](https://x/img.png)')
  })

  test('pdfs become markdown links', () => {
    expect(markdownForAttachment('https://x/doc.pdf', null, { name: 'doc.pdf', type: 'application/pdf' }))
      .toBe('[doc.pdf](https://x/doc.pdf)')
  })
})

describe('getUserUsageBytes', () => {
  test('sums metadata.size of all files for the user', async () => {
    const mockSupabase = {
      storage: {
        from: () => ({
          list: vi.fn().mockResolvedValue({
            data: [
              { name: 'a.jpg', metadata: { size: 1024 * 1024 } },
              { name: 'b.pdf', metadata: { size: 2 * 1024 * 1024 } },
            ]
          })
        })
      }
    }
    expect(await getUserUsageBytes(mockSupabase, 'u1')).toBe(3 * 1024 * 1024)
  })

  test('returns 0 when no files', async () => {
    const mockSupabase = {
      storage: { from: () => ({ list: vi.fn().mockResolvedValue({ data: [] }) }) }
    }
    expect(await getUserUsageBytes(mockSupabase, 'u1')).toBe(0)
  })

  test('handles missing metadata gracefully', async () => {
    const mockSupabase = {
      storage: {
        from: () => ({
          list: vi.fn().mockResolvedValue({
            data: [{ name: 'a.jpg', metadata: null }]
          })
        })
      }
    }
    expect(await getUserUsageBytes(mockSupabase, 'u1')).toBe(0)
  })
})

describe('uploadAttachment cap enforcement', () => {
  test('throws when adding file would exceed 500 MB cap', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      storage: {
        from: () => ({
          list: vi.fn().mockResolvedValue({
            data: [{ name: 'big.jpg', metadata: { size: 499 * 1024 * 1024 } }]
          }),
          upload: vi.fn(),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://x/signed' }, error: null }),
        })
      }
    }
    const file = { type: 'image/png', size: 2 * 1024 * 1024, name: 'new.png' }
    await expect(uploadAttachment(mockSupabase, file)).rejects.toThrow(/storage limit/i)
  })

  test('does not throw when under cap', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      storage: {
        from: () => ({
          list: vi.fn().mockResolvedValue({ data: [] }),
          upload: vi.fn().mockResolvedValue({ error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://x/signed' }, error: null }),
        })
      }
    }
    const file = { type: 'image/png', size: 1024, name: 'small.png' }
    await expect(uploadAttachment(mockSupabase, file)).resolves.not.toThrow()
  })
})
