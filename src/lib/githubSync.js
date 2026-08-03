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
  // `opportunities` must precede the two tables that reference it.
  // `opportunity_state.opportunity_id` is NOT NULL with an FK, so leaving this
  // table out meant a restore into an empty database failed outright on a
  // foreign-key violation — in precisely the disaster-recovery case backups
  // exist for. It is scraped rather than authored, but FK integrity decides
  // membership here, not authorship.
  'opportunities',
  'applications',
  'opportunity_state',
  // Parent before child: messages reference a conversation.
  'assistant_conversations',
  'assistant_messages',
  'menu_items',
  'quick_links',
  'programs',
  'companies',
  'shared_items',
]

// Tables whose primary key is not `id`, or whose natural key is what a restore
// should match on. `programs` and `companies` are global catalogues with no
// user_id and a unique name/slug: upserting them by `id` would hit that unique
// constraint whenever the same entry already exists under a different id, so
// they match on the natural key instead. Nothing references either by id, which
// is what makes that safe.
export const CONFLICT_TARGETS = {
  entry_tags: 'entry_id,tag_id',
  opportunity_state: 'user_id,opportunity_id',
  programs: 'name',
  companies: 'slug',
  shared_items: 'slug',
}

// Deliberately NOT backed up.
//
// The distinction is "can this be rebuilt, and would carrying it do harm" —
// not "is it unimportant". Anything derived is cheaper to regenerate than to
// diff on every commit; anything holding a credential must never leave the
// database; anything the server owns must not be restorable from a file the
// user can edit.
export const EXCLUDED_TABLES = {
  content_chunks: 'derived from your notes — rebuilt by scripts/rechunk.js',
  entry_embeddings: 'derived vectors — rebuilt alongside content_chunks',
  feed_items: 'refetched automatically from your feed list',
  capture_log: 'diagnostic log, not content',
  user_configs: 'contains your access token — intentionally never backed up',
  capture_tokens: 'capture credentials — revocable secrets, never written to a file',
  snapshots: 'rows describe files in the snapshots bucket; a git backup cannot carry the bytes',
  user_entitlements: 'your tier is server-owned and must not be restorable from a file',
  subscriptions: 'billing state, owned by the payment provider',
  events: 'product analytics, not your content',
  ai_usage: 'metering counters, rebuilt by use',
  admin_actions: 'operator audit log, deliberately unreachable from any client',
  app_flags: 'global operator switches, not per-account data',
}

// Bumped to 2 when the table set above grew. Older backups still restore: a
// missing data/<table>.json reads as an empty table, and parseFiles only
// refuses a backup written by a *newer* schema than it understands.
const SCHEMA_VERSION = 2

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

  // renderReadme existed but was never called, so the backup repo shipped with no
  // explanation of itself — you would open it years later and have to infer what
  // data/ was and what was missing from it. The whole point of a plain-text backup
  // is that it survives without the app to interpret it.
  files.push({ path: 'README.md', content: renderReadme(snapshot, counts) })

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
