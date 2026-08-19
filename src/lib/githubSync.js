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
  // Carried, and placed immediately after `topics` because its PK is an FK to
  // topics and applySnapshot walks this array front to back. `next_action` and
  // `parked_note` are hand-written text — the rest of the Manager is derived and
  // would rebuild itself, but no restore could regenerate a sentence you wrote.
  'topic_state',
  // After `topics` (FK) and, like topic_state, carried rather than derived:
  // a contribution is the record that a day was worked, and nothing can
  // reconstruct it. The doc it came from gets rewritten, the entry can be
  // deleted, and the grid is a history — losing it silently rewrites the past.
  'contributions',
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
  // PK is topic_id, not id.
  topic_state: 'topic_id',
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
  capture_tokens: 'capture credentials — revocable secrets, never written to a file',
  snapshots: 'rows describe files in the snapshots bucket; a git backup cannot carry the bytes',
  user_entitlements: 'your tier is server-owned and must not be restorable from a file',
  subscriptions: 'billing state, owned by the payment provider',
  events: 'product analytics, not your content',
  ai_usage: 'metering counters, rebuilt by use',
  admin_actions: 'operator audit log, deliberately unreachable from any client',
  app_flags: 'global operator switches, not per-account data',
}

// user_configs holds real user data (preferences, radar keywords, interview prep
// settings) alongside secrets (github_token) and backup plumbing (repo_name,
// auto_backup) in one row. Excluding the whole table — the simple option — throws
// the user's data out with the secret. This is the one table backed up by field
// allowlist instead of by whole row.
//
// An allowlist is the right shape here because the failure directions are not
// symmetric: forgetting to carry a field loses data, but accidentally carrying one
// can leak a credential. Defaulting to "not carried" makes the dangerous mistake
// the one you have to make on purpose.
export const USER_CONFIG_EXPORT_FIELDS = [
  'theme',
  'modules',
  'archive_toast',
  // Authored, not derived: the career radar keyword list you curate by hand in
  // Settings -> Keywords. Nothing regenerates it.
  'radar_keywords',
  // Interview prep: a deadline you chose and the tracks you are targeting.
  'prep_target_date',
  'prep_focus',
  // Carried, not excluded, even though it is null for anyone on the browser
  // default — an explicit override is a choice the user made, and losing it on
  // restore would silently move every reminder's deadline by hours without
  // anything visibly failing. NULL restores as "follow the browser", which is
  // the correct default for a machine we know nothing about.
  'timezone',
]

// The other half of the allowlist, kept as data so a test can assert that every
// column on the table is classified as one or the other. A new column that is
// neither carried nor consciously excluded is the failure this prevents — it
// would simply be absent from every backup with nothing to notice it by.
export const USER_CONFIG_EXCLUDED_FIELDS = {
  user_id: 'identity — a restore re-stamps this to the importing account',
  github_token: 'encrypted credential; never leaves the database',
  twitter_auth_token: 'session credential; never leaves the database',
  is_founder: 'server-owned tier — must not be restorable from an editable file',
  github_user: 'backup plumbing, re-established by connecting a repo',
  repo_name: 'backup plumbing',
  repo_branch: 'backup plumbing',
  is_private: 'backup plumbing',
  auto_backup: 'backup plumbing',
  last_backup_at: 'backup state, regenerated by the next run',
  last_backup_sha: 'backup state, regenerated by the next run',
  last_backup_summary: 'backup state, regenerated by the next run',
  last_error: 'diagnostic, regenerated by the next run',
  created_at: 'row metadata',
  updated_at: 'row metadata',
}

// Bumped to 4 when the profile export grew from {theme, modules} to also carry
// archive_toast, radar_keywords and the interview prep fields. Older backups still
// restore: parseFiles copies only the fields present, so a v3 file restores its two
// and leaves the rest untouched rather than clearing them.
const SCHEMA_VERSION = 4

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
    `- \`data/user_configs.json\` — your profile, by field allowlist: ` +
      `${USER_CONFIG_EXPORT_FIELDS.join(', ')}`,
    '',
    '## Not included',
    '',
    ...Object.entries(EXCLUDED_TABLES).map(([t, why]) => `- \`${t}\` — ${why}`),
    '',
    'Fields of `user_configs` deliberately left out — credentials, server-owned',
    'state and backup plumbing:',
    '',
    ...Object.entries(USER_CONFIG_EXCLUDED_FIELDS).map(([f, why]) => `- \`${f}\` — ${why}`),
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

  // Apply the allowlist HERE, at the point bytes leave the system — not only in
  // collectSnapshot. It was previously enforced at collection alone, so buildFiles
  // wrote whatever it was handed: any caller passing a fuller row (a test, a
  // future importer, a refactor that forgets the `.select()`) would have written
  // github_token straight into a file destined for a git repo. A credential
  // boundary has to hold at the boundary, not upstream of it.
  const source = snapshot.user_config ?? null
  let userConfig = null
  if (source) {
    userConfig = {}
    for (const field of USER_CONFIG_EXPORT_FIELDS) {
      if (field in source) userConfig[field] = source[field]
    }
  }
  counts.user_configs = userConfig ? 1 : 0
  files.push({
    path: 'data/user_configs.json',
    content: `${JSON.stringify(userConfig ? [userConfig] : [], null, 2)}\n`,
  })

  files.push({
    path: 'data/manifest.json',
    content: `${JSON.stringify({
      schema_version: SCHEMA_VERSION,
      exported_at: snapshot.exported_at,
      app: 'medialog',
      // Which account wrote this. A backup commit REPLACES data/*.json wholesale
      // rather than merging, and applySnapshot re-stamps user_id onto every row —
      // so without an owner marker two accounts pointing at one repo silently
      // clobber each other, and a restore absorbs the other library as your own
      // with no way to tell afterwards. This is the only thing that makes either
      // collision detectable. An account id, not a credential.
      account_id: snapshot.account_id ?? null,
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

  // Read back through the same allowlist used to write it, in case an older
  // or hand-edited backup file carries more than {theme, modules}.
  let user_config = null
  const userConfigRaw = byPath.get('data/user_configs.json')
  if (userConfigRaw) {
    const parsed = JSON.parse(userConfigRaw)
    if (!Array.isArray(parsed)) throw new Error('data/user_configs.json is not an array')
    if (parsed[0]) {
      user_config = {}
      for (const field of USER_CONFIG_EXPORT_FIELDS) {
        if (field in parsed[0]) user_config[field] = parsed[0][field]
      }
    }
  }

  return {
    exported_at: manifest.exported_at,
    schema_version: manifest.schema_version,
    // null for backups written before this existed — callers must treat unknown
    // as "cannot tell", never as "same account".
    account_id: manifest.account_id ?? null,
    tables,
    user_config,
  }
}

/** Row counts per table, for showing "what am I about to restore". */
export function summarize(snapshot) {
  const out = {}
  for (const table of SYNC_TABLES) out[table] = (snapshot.tables?.[table] ?? []).length
  out.user_configs = snapshot.user_config ? 1 : 0
  return out
}
