import { vi, test, expect, describe, afterEach } from 'vitest'
import { createThumbnail } from './thumbnail.js'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockCanvas(blobResult) {
  const ctx = { drawImage: vi.fn() }
  const canvas = {
    width: 0, height: 0,
    getContext: () => ctx,
    toBlob: (cb, _mime, _q) => cb(blobResult),
  }
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'canvas') return canvas
    return document.createElement.wrappedJSObject?.(tag) ?? {}
  })
  return canvas
}

function mockURL() {
  URL.createObjectURL = vi.fn().mockReturnValue('blob:fake')
  URL.revokeObjectURL = vi.fn()
}

describe('createThumbnail', () => {
  test('is a function', () => {
    expect(typeof createThumbnail).toBe('function')
  })

  test('resolves with a Blob when canvas toBlob succeeds', async () => {
    const fakeBlob = new Blob(['fake'], { type: 'image/webp' })
    mockCanvas(fakeBlob)
    mockURL()

    const OriginalImage = globalThis.Image
    globalThis.Image = class {
      set src(_) { setTimeout(() => this.onload?.(), 0) }
      get width() { return 1200 }
      get height() { return 800 }
    }

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await createThumbnail(file, 600, 0.5)
    expect(result).toBe(fakeBlob)

    globalThis.Image = OriginalImage
  })

  test('rejects when canvas toBlob returns null', async () => {
    mockCanvas(null)
    mockURL()

    const OriginalImage = globalThis.Image
    globalThis.Image = class {
      set src(_) { setTimeout(() => this.onload?.(), 0) }
      get width() { return 100 }
      get height() { return 100 }
    }

    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
    await expect(createThumbnail(file)).rejects.toThrow('Canvas toBlob failed')

    globalThis.Image = OriginalImage
  })
})
