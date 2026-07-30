import { describe, test, expect } from 'vitest'
import { buildMarkdownFiles, buildTopicMarkdown, buildDeepTopicMarkdown, topicFilename } from '../../../src/lib/exportMarkdown.js'

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

describe('buildDeepTopicMarkdown', () => {
  const data = {
    topic: { id: 'd1', name: 'Attention Paper', source_url: 'http://arxiv.org/x' },
    sections: [
      { id: 's2', title: 'Results', position: 2, status: 'reading' },
      { id: 's1', title: 'Method', position: 1, status: 'done' },
    ],
    takeaways: [
      { id: 'k1', section_id: 's1', parent_id: null, takeaway: 'self-attention', note: 'quote here' },
      { id: 'k2', section_id: 's1', parent_id: 'k1', takeaway: 'tangent on cost', note: '' },
      { id: 'k3', section_id: 's2', parent_id: null, takeaway: 'beats baseline', note: '' },
    ],
  }

  test('orders sections by position, not array order', () => {
    const md = buildDeepTopicMarkdown(data)
    expect(md.indexOf('## Method')).toBeLessThan(md.indexOf('## Results'))
  })

  test('nests tangents under their parent takeaway', () => {
    const md = buildDeepTopicMarkdown(data)
    expect(md).toContain('- self-attention')
    expect(md).toContain('  quote here')
    expect(md).toContain('  - tangent on cost')
  })

  test('records source and counts in front matter', () => {
    const md = buildDeepTopicMarkdown(data)
    expect(md).toContain('kind: deep-topic')
    expect(md).toContain('source: http://arxiv.org/x')
    expect(md).toContain('sections: 2')
    expect(md).toContain('takeaways: 3')
  })

  test('marks empty sections instead of dropping them', () => {
    const md = buildDeepTopicMarkdown({ ...data, sections: [{ id: 's9', title: 'Intro', position: 0 }], takeaways: [] })
    expect(md).toContain('## Intro')
    expect(md).toContain('_No takeaways._')
  })

  test('keeps takeaways whose section is missing under Unfiled', () => {
    const md = buildDeepTopicMarkdown({
      topic: { id: 'd1', name: 'X' },
      sections: [],
      takeaways: [{ id: 'k1', section_id: 'gone', parent_id: null, takeaway: 'orphan', note: '' }],
    })
    expect(md).toContain('## Unfiled')
    expect(md).toContain('- orphan')
  })
})

describe('topicFilename', () => {
  test('appends .md and strips path-hostile characters', () => {
    expect(topicFilename('A/B: C')).toBe('A-B- C.md')
  })
})
