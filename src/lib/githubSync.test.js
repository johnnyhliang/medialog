import { describe, test, expect } from 'vitest'
import { buildFiles, parseFiles, summarize, renderEntryMarkdown, SYNC_TABLES } from './githubSync.js'

const snapshot = {
  exported_at: '2026-07-22T00:00:00.000Z',
  tables: {
    topics: [{ id: 't1', name: 'Quant' }, { id: 't2', name: 'Bad/Name: Here' }],
    entries: [
      { id: 'e1111111-aaaa', topic_id: 't1', title: 'Trading and Exchanges', note: 'spread notes', status: 'active', pinned: true, created_at: '2026-01-01T00:00:00Z' },
      { id: 'e2222222-bbbb', topic_id: 't2', title: 'Weird: Title?', note: '', takeaway: 'the point', status: 'done', created_at: '2026-01-02T00:00:00Z' },
      { id: 'e3333333-cccc', topic_id: null, title: 'Orphan', note: 'no topic', status: 'backlog', created_at: '2026-01-03T00:00:00Z' },
    ],
    tags: [{ id: 'g1', name: 'microstructure' }],
    entry_tags: [{ entry_id: 'e1111111-aaaa', tag_id: 'g1' }],
    entry_versions: [], highlights: [], resource_sections: [],
    feeds: [], applications: [], opportunity_state: [],
  },
}

const asMap = (files) => new Map(files.map((f) => [f.path, f.content]))

describe('buildFiles', () => {
  test('writes one json file per synced table plus a manifest', () => {
    const paths = buildFiles(snapshot).map((f) => f.path)
    for (const t of SYNC_TABLES) expect(paths).toContain(`data/${t}.json`)
    expect(paths).toContain('data/manifest.json')
  })

  test('json files hold the exact rows, not a rendering', () => {
    const files = asMap(buildFiles(snapshot))
    expect(JSON.parse(files.get('data/entries.json'))).toEqual(snapshot.tables.entries)
  })

  test('never writes derived or secret tables', () => {
    const paths = buildFiles(snapshot).map((f) => f.path).join(' ')
    expect(paths).not.toMatch(/content_chunks|feed_items|capture_log|user_configs/)
  })

  test('mirrors entries as markdown under their topic, sanitising path segments', () => {
    const paths = buildFiles(snapshot).map((f) => f.path)
    expect(paths).toContain('notes/Quant/Trading and Exchanges-e1111111.md')
    // "Bad/Name: Here" must not become nested directories
    expect(paths).toContain('notes/Bad-Name- Here/Weird- Title--e2222222.md')
  })

  test('entries with no topic still get a file', () => {
    const paths = buildFiles(snapshot).map((f) => f.path)
    expect(paths).toContain('notes/uncategorised/Orphan-e3333333.md')
  })

  test('two entries with the same title and id prefix both survive', () => {
    const dup = {
      exported_at: 'x',
      tables: {
        ...snapshot.tables,
        entries: [
          { id: 'aaaaaaaa-1', topic_id: 't1', title: 'Same', note: 'first' },
          { id: 'aaaaaaaa-2', topic_id: 't1', title: 'Same', note: 'second' },
        ],
      },
    }
    const md = buildFiles(dup).filter((f) => f.path.startsWith('notes/'))
    expect(md).toHaveLength(2)
    expect(new Set(md.map((f) => f.path)).size).toBe(2)
  })

  test('the manifest records per-table counts', () => {
    const manifest = JSON.parse(asMap(buildFiles(snapshot)).get('data/manifest.json'))
    expect(manifest.counts.entries).toBe(3)
    expect(manifest.counts.topics).toBe(2)
    expect(manifest.schema_version).toBe(1)
  })
})

describe('renderEntryMarkdown', () => {
  test('carries tags and the id in front-matter and the note as the body', () => {
    const md = renderEntryMarkdown(snapshot.tables.entries[0], ['microstructure'])
    expect(md).toMatch(/^---\n/)
    expect(md).toContain('tags: ["microstructure"]')
    expect(md).toContain('id: "e1111111-aaaa"')
    expect(md).toContain('pinned: true')
    expect(md.trimEnd().endsWith('spread notes')).toBe(true)
  })

  test('appends a takeaway section when there is one', () => {
    expect(renderEntryMarkdown(snapshot.tables.entries[1])).toContain('## Takeaway')
  })
})

describe('parseFiles', () => {
  test('round-trips a snapshot exactly', () => {
    const parsed = parseFiles(buildFiles(snapshot))
    expect(parsed.tables).toEqual(snapshot.tables)
    expect(parsed.exported_at).toBe(snapshot.exported_at)
  })

  test('ignores the markdown mirror entirely', () => {
    const files = buildFiles(snapshot).map((f) =>
      f.path.startsWith('notes/') ? { ...f, content: 'CORRUPTED' } : f,
    )
    expect(parseFiles(files).tables.entries).toEqual(snapshot.tables.entries)
  })

  test('refuses a repo that is not a MediaLog backup', () => {
    expect(() => parseFiles([{ path: 'README.md', content: 'hi' }])).toThrow(/not a MediaLog backup/i)
  })

  test('refuses a backup from a newer schema rather than importing it wrong', () => {
    const files = buildFiles(snapshot).map((f) =>
      f.path === 'data/manifest.json'
        ? { ...f, content: JSON.stringify({ schema_version: 99, exported_at: 'x', counts: {} }) }
        : f,
    )
    expect(() => parseFiles(files)).toThrow(/newer version/i)
  })

  test('treats a missing table file as empty rather than failing', () => {
    const files = buildFiles(snapshot).filter((f) => f.path !== 'data/highlights.json')
    expect(parseFiles(files).tables.highlights).toEqual([])
  })

  test('rejects a table file that is not an array', () => {
    const files = buildFiles(snapshot).map((f) =>
      f.path === 'data/topics.json' ? { ...f, content: '{"nope":true}' } : f,
    )
    expect(() => parseFiles(files)).toThrow(/not an array/i)
  })
})

describe('summarize', () => {
  test('counts every synced table, including empty ones', () => {
    const counts = summarize(snapshot)
    expect(counts.entries).toBe(3)
    expect(counts.highlights).toBe(0)
    expect(Object.keys(counts).sort()).toEqual([...SYNC_TABLES].sort())
  })
})
