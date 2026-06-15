// Build a { filename: markdown } map, one file per topic that has entries.
export function buildMarkdownFiles(topics, entries) {
  const files = {}
  for (const topic of topics) {
    const own = entries.filter((e) => e.topic_id === topic.id)
    if (own.length === 0) continue
    files[`${safeName(topic.name)}.md`] = renderTopic(topic, own)
  }
  return files
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '-')
}

function renderTopic(topic, entries) {
  const lines = [`# ${topic.name}`, '']
  for (const e of entries) {
    if (e.url) lines.push(`## [${e.title || e.url}](${e.url})`)
    else lines.push(`## ${(e.note || 'note').split('\n')[0].slice(0, 60)}`)
    const meta = []
    if (e.status) meta.push(`status: ${e.status}`)
    if (e.tags && e.tags.length) meta.push(`tags: ${e.tags.join(', ')}`)
    if (meta.length) lines.push(`> ${meta.join(' · ')}`)
    lines.push('')
    if (e.note) { lines.push(e.note); lines.push('') }
  }
  return lines.join('\n')
}
