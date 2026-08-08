import { describe, test, expect } from 'vitest'
import { buildMarkdownFiles, buildTopicMarkdown, topicFilename } from '../../../src/lib/exportMarkdown.js'

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

describe('buildTopicMarkdown', () => {
  const topic = { id: 't1', name: 'AI', master_doc: '# synthesis\n\nthe point' }
  const entries = [{ id: 'e1', topic_id: 't1', url: 'http://a.com', title: 'A', note: 'takeaway', tags: [] }]

  test('includes front matter with topic name and entry count', () => {
    const md = buildTopicMarkdown(topic, entries)
    expect(md.startsWith('---\n')).toBe(true)
    expect(md).toContain('topic: AI')
    expect(md).toContain('kind: topic')
    expect(md).toContain('entries: 1')
  })

  test('puts the master doc above the entries', () => {
    const md = buildTopicMarkdown(topic, entries)
    expect(md).toContain('## Doc')
    expect(md).toContain('the point')
    expect(md.indexOf('## Doc')).toBeLessThan(md.indexOf('## Entries'))
  })

  test('omits the doc section when the topic has no doc', () => {
    const md = buildTopicMarkdown({ id: 't1', name: 'AI' }, entries)
    expect(md).not.toContain('## Doc')
    expect(md).toContain('[A](http://a.com)')
  })

  test('handles a topic with a doc and no entries', () => {
    const md = buildTopicMarkdown(topic, [])
    expect(md).toContain('the point')
    expect(md).not.toContain('## Entries')
  })
})

describe('topicFilename', () => {
  test('appends .md and strips path-hostile characters', () => {
    expect(topicFilename('A/B: C')).toBe('A-B- C.md')
  })
})
