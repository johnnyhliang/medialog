// Full-fidelity GitHub sync: what gets written to the repo and how it reads back.
//
// Two representations live side by side in the repo:
//
//   data/<table>.json  — exact rows, the source of truth for a restore.
//   notes/<topic>/…md  — human-readable markdown, so the repo is worth browsing
//                        on github.com and survives MediaLog itself.
//
// A restore reads ONLY data/*.json. The markdown is a rendering, not the record —
// round-tripping prose through YAML front-matter loses types and silently mangles
// edge cases, which is how the old pull path created duplicates.

// Tables carried in a backup. Order matters: parents before children, so a
// restore can satisfy foreign keys by applying the list front to back.
export const SYNC_TABLES = [
  'topics',
  'entries',
  'tags',
  'entry_tags',
  'entry_versions',
  'highlights',
  'resource_sections',
  'feeds',
  'applications',
  'opportunity_state',
]

// Deliberately NOT backed up:
//   content_chunks — derived. ~950 rows x 768 floats would add megabytes of churn
//                    to every commit, and `scripts/rechunk.js` rebuilds it.
//   feed_items     — derived from feeds, regenerates on the next poll.
//   capture_log    — an append-only log, not user content.
//   user_configs   — holds the encrypted GitHub token. Never leaves the database.
export const EXCLUDED_TABLES = {
  content_chunks: 'derived from your notes — rebuilt by scripts/rechunk.js',
  feed_items: 'refetched automatically from your feed list',
  capture_log: 'diagnostic log, not content',
  user_configs: 'contains your access token — intentionally never backed up',
}

const SCHEMA_VERSION = 1

function safeName(s, fallback = 'untitled') {
  const cleaned = String(s ?? '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return cleaned || fallback
}

export function renderEntryMarkdown(entry, tags = []) {
  const front = [
    '---',
    `title: ${JSON.stringify(entry.title || '')}`,
    `url: ${JSON.stringify(entry.url || '')}`,
    `status: ${entry.status || 'backlog'}`,
  ]
  if (tags.length) front.push(`tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`)
  if (entry.pinned) front.push('pinned: true')
  front.push(`created_at: ${JSON.stringify(entry.created_at ?? null)}`)
  front.push(`id: ${JSON.stringify(entry.id)}`)
  front.push('---', '')
  const body = [entry.note || '']
  if (entry.takeaway) body.push('', '## Takeaway', '', entry.takeaway)
  return `${front.join('\n')}${body.join('\n')}\n`
}

function renderReadme(snapshot, counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const lines = [
    '# MediaLog backup',
    '',
    `Snapshot taken ${snapshot.exported_at}. ${total} rows across ${Object.keys(counts).length} tables.`,
    '',
    '`data/` holds the exact rows and is what a restore reads.',
    '`notes/` holds the same entries as readable markdown, one file per entry.',
    '',
    '## Contents',
    '',
    ...SYNC_TABLES.map((t) => `- \`data/${t}.json\` — ${counts[t] ?? 0} rows`),
    '',
    '## Not included',
    '',
    ...Object.entries(EXCLUDED_TABLES).map(([t, why]) => `- \`${t}\` — ${why}`),
    '',
  ]
  return lines.join('\n')
}

/**
 * Turn a snapshot ({ tables: { entries: [...], ... }, exported_at }) into the
 * files to commit. Returns [{ path, content }].
 */
export function buildFiles(snapshot) {
  const tables = snapshot.tables ?? {}
  const counts = {}
  const files = []

  for (const table of SYNC_TABLES) {
    const rows = tables[table] ?? []
    counts[table] = rows.length
    files.push({
      path: `data/${table}.json`,
      content: `${JSON.stringify(rows, null, 2)}\n`,
    })
  }

  files.push({
    path: 'data/manifest.json',
    content: `${JSON.stringify({
      schema_version: SCHEMA_VERSION,
      exported_at: snapshot.exported_at,
      app: 'medialog',
      counts,
    }, null, 2)}\n`,
  })

  // Readable mirror. Entries without a topic still get a home so nothing is
  // invisible when browsing the repo.
  const topicName = new Map((tables.topics ?? []).map((t) => [t.id, t.name]))
  const tagName = new Map((tables.tags ?? []).map((t) => [t.id, t.name]))
  const tagsByEntry = new Map()
  for (const et of tables.entry_tags ?? []) {
    const name = tagName.get(et.tag_id)
    if (!name) continue
    if (!tagsByEntry.has(et.entry_id)) tagsByEntry.set(et.entry_id, [])
    tagsByEntry.get(et.entry_id).push(name)
  }

  const used = new Set()
  for (const entry of tables.entries ?? []) {
    const folder = safeName(topicName.get(entry.topic_id), 'uncategorised')
    let path = `notes/${folder}/${safeName(entry.title, 'untitled')}-${String(entry.id).slice(0, 8)}.md`
    // Two entries can share a title AND an id prefix; keep both files.
    while (used.has(path)) path = path.replace(/\.md$/, `-${used.size}.md`)
    used.add(path)
    files.push({ path, content: renderEntryMarkdown(entry, tagsByEntry.get(entry.id) ?? []) })
  }

  return files
}

/**
 * Read a snapshot back out of repo files. Only data/*.json is trusted.
 * `files` is [{ path, content }].
 */
export function parseFiles(files) {
  const byPath = new Map(files.map((f) => [f.path, f.content]))
  const manifestRaw = byPath.get('data/manifest.json')
  if (!manifestRaw) {
    throw new Error('No data/manifest.json in the repo — this is not a MediaLog backup.')
  }
  const manifest = JSON.parse(manifestRaw)
  if (manifest.schema_version > SCHEMA_VERSION) {
    throw new Error(
      `Backup was written by a newer version of MediaLog (schema ${manifest.schema_version}). Update before restoring.`,
    )
  }

  const tables = {}
  for (const table of SYNC_TABLES) {
    const raw = byPath.get(`data/${table}.json`)
    if (!raw) { tables[table] = []; continue }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error(`data/${table}.json is not an array`)
    tables[table] = parsed
  }
  return { exported_at: manifest.exported_at, schema_version: manifest.schema_version, tables }
}

/** Row counts per table, for showing "what am I about to restore". */
export function summarize(snapshot) {
  const out = {}
  for (const table of SYNC_TABLES) out[table] = (snapshot.tables?.[table] ?? []).length
  return out
}
