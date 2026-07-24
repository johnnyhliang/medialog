// Build a { filename: markdown } map, one file per topic that has entries.
export function buildMarkdownFiles(topics, entries) {
  const files = {}
  for (const topic of topics) {
    const own = entries.filter((e) => e.topic_id === topic.id)
    if (own.length === 0) continue
    files[topicFilename(topic.name)] = buildTopicMarkdown(topic, own)
  }
  return files
}

export function topicFilename(name) {
  return `${safeName(name)}.md`
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '-')
}

// A small YAML header so an assistant reading the file knows what it is and
// how fresh it is without inferring from the body.
function frontMatter(fields) {
  const lines = ['---']
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === '') continue
    lines.push(`${k}: ${v}`)
  }
  lines.push('---', '')
  return lines
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// One self-contained file for a normal topic: doc first (the synthesis), then
// the entries it was built from.
export function buildTopicMarkdown(topic, entries) {
  const lines = frontMatter({
    topic: topic.name,
    kind: 'topic',
    entries: entries.length,
    exported: today(),
  })
  lines.push(`# ${topic.name}`, '')

  const doc = (topic.master_doc || '').trim()
  if (doc) lines.push('## Doc', '', doc, '')

  if (entries.length) {
    if (doc) lines.push('## Entries', '')
    for (const e of entries) {
      if (e.url) lines.push(`### [${e.title || e.url}](${e.url})`)
      else lines.push(`### ${(e.note || 'note').split('\n')[0].slice(0, 60)}`)
      const meta = []
      if (e.status) meta.push(`status: ${e.status}`)
      if (e.tags && e.tags.length) meta.push(`tags: ${e.tags.join(', ')}`)
      if (meta.length) lines.push(`> ${meta.join(' · ')}`)
      lines.push('')
      if (e.note) { lines.push(e.note); lines.push('') }
    }
  }
  return lines.join('\n')
}

// Deep topics carry structure the flat entry renderer can't see: ordered
// sections, each with takeaways, each of which may have nested tangents.
export function buildDeepTopicMarkdown({ topic, sections = [], takeaways = [] }) {
  const lines = frontMatter({
    topic: topic.name,
    kind: 'deep-topic',
    source: topic.source_url,
    sections: sections.length,
    takeaways: takeaways.length,
    exported: today(),
  })
  lines.push(`# ${topic.name}`, '')
  if (topic.source_url) lines.push(`Source: ${topic.source_url}`, '')

  const ordered = [...sections].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const childrenOf = (id) => takeaways.filter((t) => t.parent_id === id)

  for (const s of ordered) {
    const roots = takeaways.filter((t) => t.section_id === s.id && !t.parent_id)
    lines.push(`## ${s.title}`)
    if (s.status) lines.push(`> status: ${s.status}`)
    lines.push('')
    if (!roots.length) { lines.push('_No takeaways._', ''); continue }
    for (const t of roots) {
      lines.push(...renderTakeaway(t, 0))
      for (const c of childrenOf(t.id)) lines.push(...renderTakeaway(c, 1))
    }
    lines.push('')
  }

  // Takeaways whose section was deleted would otherwise vanish from the export.
  const known = new Set(ordered.map((s) => s.id))
  const orphans = takeaways.filter((t) => !known.has(t.section_id) && !t.parent_id)
  if (orphans.length) {
    lines.push('## Unfiled', '')
    for (const t of orphans) {
      lines.push(...renderTakeaway(t, 0))
      for (const c of childrenOf(t.id)) lines.push(...renderTakeaway(c, 1))
    }
    lines.push('')
  }

  return lines.join('\n')
}

function renderTakeaway(t, depth) {
  const pad = '  '.repeat(depth)
  const out = [`${pad}- ${t.takeaway}`]
  if (t.note) {
    for (const line of String(t.note).split('\n')) out.push(`${pad}  ${line}`)
  }
  return out
}
