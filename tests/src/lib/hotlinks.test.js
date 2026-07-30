import { describe, test, expect } from 'vitest'
import { extractHotlinks, collectHotlinks, fileTypeFromUrl, fileNameFromUrl } from '../../../src/lib/hotlinks.js'

describe('hotlinks', () => {
  test('extracts markdown images and media links, ignores non-media links', () => {
    const note = `
      ![a diagram](https://imgur.com/abc.png)
      [spec pdf](https://example.com/spec.pdf)
      [a normal link](https://example.com/article)
      bare https://cdn.site.com/pic.jpg here
    `
    const urls = extractHotlinks(note).map((h) => h.url)
    expect(urls).toContain('https://imgur.com/abc.png')
    expect(urls).toContain('https://example.com/spec.pdf')
    expect(urls).toContain('https://cdn.site.com/pic.jpg')
    expect(urls).not.toContain('https://example.com/article')
  })

  test('excludes Supabase Storage/attachment URLs (those are uploads)', () => {
    const note = '![up](https://x.supabase.co/storage/v1/object/sign/attachments/u/1-a.png)'
    expect(extractHotlinks(note)).toEqual([])
  })

  test('dedupes within a note', () => {
    const note = '![](https://i.im/x.png) again ![](https://i.im/x.png)'
    expect(extractHotlinks(note)).toHaveLength(1)
  })

  test('fileType + fileName helpers', () => {
    expect(fileTypeFromUrl('https://a.com/b.pdf')).toBe('pdf')
    expect(fileTypeFromUrl('https://a.com/b.PNG?v=2')).toBe('image')
    expect(fileNameFromUrl('https://a.com/docs/report%20final.pdf')).toBe('report final.pdf')
  })

  test('collectHotlinks rolls up refs across entries', () => {
    const entries = [
      { id: 'e1', title: 'One', topic_id: 't1', note: '![](https://i.im/x.png)' },
      { id: 'e2', title: 'Two', topic_id: 't1', note: 'see https://i.im/x.png and [d](https://a.com/d.pdf)' },
    ]
    const rows = collectHotlinks(entries)
    const png = rows.find((r) => r.url === 'https://i.im/x.png')
    expect(png.refs.map((r) => r.id)).toEqual(['e1', 'e2'])
    expect(rows.find((r) => r.url === 'https://a.com/d.pdf').refs).toHaveLength(1)
  })
})
