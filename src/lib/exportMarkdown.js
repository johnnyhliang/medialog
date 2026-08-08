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
