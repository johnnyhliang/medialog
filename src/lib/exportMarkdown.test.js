import { describe, test, expect } from 'vitest'
import { buildMarkdownFiles } from './exportMarkdown.js'

describe('buildMarkdownFiles', () => {
  test('produces one file per topic with entry sections', () => {
    const topics = [{ id: 't1', name: 'AI' }]
    const entries = [
      { id: 'e1', topic_id: 't1', url: 'http://a.com', title: 'A', note: 'takeaway', status: 'done', tags: ['book'] },
    ]
    const files = buildMarkdownFiles(topics, entries)
    expect(Object.keys(files)).toEqual(['AI.md'])
    const md = files['AI.md']
    expect(md).toContain('# AI')
    expect(md).toContain('[A](http://a.com)')
    expect(md).toContain('takeaway')
    expect(md).toContain('status: done')
    expect(md).toContain('tags: book')
  })

  test('skips topics with no entries', () => {
    const files = buildMarkdownFiles([{ id: 't1', name: 'Empty' }], [])
    expect(files).toEqual({})
  })

  test('sanitizes topic name into a safe filename', () => {
    const topics = [{ id: 't1', name: 'Project: Thesis/Notes' }]
    const entries = [{ id: 'e1', topic_id: 't1', url: null, title: null, note: 'x', status: null, tags: [] }]
    const files = buildMarkdownFiles(topics, entries)
    expect(Object.keys(files)).toEqual(['Project- Thesis-Notes.md'])
  })
})
