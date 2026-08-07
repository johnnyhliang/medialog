import { describe, test, expect } from 'vitest'
import { buildFiles, parseFiles, summarize, renderEntryMarkdown, SYNC_TABLES, EXCLUDED_TABLES, CONFLICT_TARGETS, USER_CONFIG_EXPORT_FIELDS, USER_CONFIG_EXCLUDED_FIELDS } from '../../../src/lib/githubSync.js'

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
    topic_state: [],
    entry_versions: [], highlights: [], resource_sections: [],
    feeds: [], opportunities: [], applications: [], opportunity_state: [],
    assistant_conversations: [], assistant_messages: [],
    menu_items: [], quick_links: [],
    programs: [], companies: [], shared_items: [],
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
    expect(paths).not.toMatch(/content_chunks|feed_items|capture_log/)
  })

  test('user_configs is written by allowlist only, never the secret fields', () => {
    const files = asMap(buildFiles({ ...snapshot, user_config: { theme: { palette: 'warm' }, modules: {} } }))
    const content = files.get('data/user_configs.json')
    expect(content).toBeDefined()
    expect(content).not.toMatch(/github_token|repo_name|auto_backup/)
    expect(JSON.parse(content)).toEqual([{ theme: { palette: 'warm' }, modules: {} }])
  })

  test('user_configs with no snapshot preferences writes an empty array', () => {
    const content = asMap(buildFiles(snapshot)).get('data/user_configs.json')
    expect(JSON.parse(content)).toEqual([])
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
    expect(manifest.schema_version).toBe(4)
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

  test('round-trips user_config through the same allowlist, dropping anything else', () => {
    const withConfig = { ...snapshot, user_config: { theme: { palette: 'warm' }, modules: { assistant: false } } }
    const parsed = parseFiles(buildFiles(withConfig))
    expect(parsed.user_config).toEqual({ theme: { palette: 'warm' }, modules: { assistant: false } })
  })

  test('strips secret fields even from a hand-edited backup file', () => {
    const files = buildFiles(snapshot).map((f) =>
      f.path === 'data/user_configs.json'
        ? { ...f, content: JSON.stringify([{ theme: { palette: 'warm' }, github_token: 'leaked' }]) }
        : f,
    )
    expect(parseFiles(files).user_config).toEqual({ theme: { palette: 'warm' } })
  })

  test('a backup with no preferences parses to a null user_config', () => {
    expect(parseFiles(buildFiles(snapshot)).user_config).toBeNull()
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
    expect(counts.user_configs).toBe(0)
    expect(Object.keys(counts).sort()).toEqual([...SYNC_TABLES, 'user_configs'].sort())
  })
})

describe('table coverage', () => {
  // The bug this guards: opportunity_state.opportunity_id is NOT NULL with an FK
  // to opportunities, but opportunities was not in SYNC_TABLES. Restoring into an
  // empty database therefore failed on a foreign-key violation — in exactly the
  // disaster-recovery case the backup exists for. applySnapshot walks SYNC_TABLES
  // front to back, so ordering is a correctness property, not cosmetics.
  const PARENT_BEFORE_CHILD = [
    ['topics', 'entries'],
    ['entries', 'entry_tags'],
    ['tags', 'entry_tags'],
    ['entries', 'entry_versions'],
    ['entries', 'highlights'],
    ['opportunities', 'opportunity_state'],
    ['opportunities', 'applications'],
    ['assistant_conversations', 'assistant_messages'],
  ]

  test.each(PARENT_BEFORE_CHILD)('%s is restored before %s', (parent, child) => {
    const p = SYNC_TABLES.indexOf(parent)
    const c = SYNC_TABLES.indexOf(child)
    expect(p).toBeGreaterThanOrEqual(0)
    expect(c).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThan(c)
  })

  // Data that was silently absent before: losing any of these loses real user
  // work with no way to notice until a restore comes up short.
  test.each([
    'assistant_conversations', 'assistant_messages',
    'menu_items', 'quick_links',
    'programs', 'companies', 'shared_items',
  ])('%s is backed up', (table) => {
    expect(SYNC_TABLES).toContain(table)
  })

  test('every table is either synced or explicitly excluded, never just forgotten', () => {
    const overlap = SYNC_TABLES.filter((t) => t in EXCLUDED_TABLES)
    expect(overlap).toEqual([])
  })

  // Upserting a global catalogue by id collides with its unique name/slug the
  // moment the same row already exists under a different id.
  test('global catalogues match on their natural key, not id', () => {
    expect(CONFLICT_TARGETS.programs).toBe('name')
    expect(CONFLICT_TARGETS.companies).toBe('slug')
    expect(CONFLICT_TARGETS.shared_items).toBe('slug')
  })

  test('composite-keyed tables keep their pair targets', () => {
    expect(CONFLICT_TARGETS.entry_tags).toBe('entry_id,tag_id')
    expect(CONFLICT_TARGETS.opportunity_state).toBe('user_id,opportunity_id')
  })

  test('a v1 backup still restores, with the new tables reading as empty', () => {
    const v1 = [
      { path: 'data/manifest.json', content: JSON.stringify({ schema_version: 1, exported_at: 'x', counts: {} }) },
      { path: 'data/entries.json', content: JSON.stringify([{ id: 'e1', title: 'kept' }]) },
    ]
    const snap = parseFiles(v1)
    expect(snap.tables.entries).toHaveLength(1)
    expect(snap.tables.assistant_conversations).toEqual([])
  })
})

describe('the backup repo explains itself', () => {
  // A plain-text backup is only durable if it can be understood without the app
  // that wrote it. renderReadme existed but was never called, so the repo shipped
  // with no explanation of what data/ was or what was missing from it.
  const readme = () => asMap(buildFiles(snapshot)).get('README.md')

  test('a README is committed alongside the data', () => {
    expect(readme()).toBeDefined()
  })

  test('it lists every synced table with a row count', () => {
    const text = readme()
    for (const t of SYNC_TABLES) expect(text).toContain(`data/${t}.json`)
    expect(text).toContain('- `data/entries.json` — 3 rows')
  })

  test('it names what is NOT included, so the gaps are discoverable', () => {
    const text = readme()
    for (const t of Object.keys(EXCLUDED_TABLES)) expect(text).toContain(t)
  })

  test('it does not confuse the restore, which reads only data/*.json', () => {
    expect(parseFiles(buildFiles(snapshot)).tables.entries).toEqual(snapshot.tables.entries)
  })
})

describe('profile export (user_configs by field allowlist)', () => {
  const profile = {
    theme: { palette: 'nord', style: 'glass' },
    modules: { uploads: true },
    archive_toast: false,
    radar_keywords: ['quant', 'systems'],
    prep_target_date: '2026-12-01',
    prep_focus: ['swe', 'sysdesign'],
  }
  const withProfile = { ...snapshot, user_config: profile }

  test('carries the profile as its own json file', () => {
    const written = JSON.parse(asMap(buildFiles(withProfile)).get('data/user_configs.json'))
    expect(written).toEqual([profile])
  })

  test('round-trips every exported field, both directions', () => {
    expect(parseFiles(buildFiles(withProfile)).user_config).toEqual(profile)
  })

  // The gap this closes: radar_keywords and the interview prep fields are authored
  // by hand and regenerated by nothing, and were absent from every backup.
  test.each(['radar_keywords', 'prep_target_date', 'prep_focus', 'archive_toast'])(
    '%s is carried — it is user-authored, not derived',
    (field) => { expect(USER_CONFIG_EXPORT_FIELDS).toContain(field) },
  )

  test.each(['github_token', 'twitter_auth_token', 'is_founder'])(
    '%s is never written to a file',
    (field) => {
      expect(USER_CONFIG_EXPORT_FIELDS).not.toContain(field)
      expect(USER_CONFIG_EXCLUDED_FIELDS).toHaveProperty(field)
      const files = buildFiles({ ...withProfile, user_config: { ...profile, [field]: 'SECRET' } })
      expect(files.map((f) => f.content).join(' ')).not.toContain('SECRET')
    },
  )

  test('a v3 backup restores its fields without clearing the newer ones', () => {
    const v3 = [
      { path: 'data/manifest.json', content: JSON.stringify({ schema_version: 3, exported_at: 'x', counts: {} }) },
      { path: 'data/user_configs.json', content: JSON.stringify([{ theme: { palette: 'nord' } }]) },
    ]
    expect(parseFiles(v3).user_config).toEqual({ theme: { palette: 'nord' } })
  })

  test('no profile file at all reads as "nothing to restore", not as empty settings', () => {
    const files = buildFiles(withProfile).filter((f) => f.path !== 'data/user_configs.json')
    expect(parseFiles(files).user_config).toBeNull()
  })
})
