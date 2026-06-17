// Transforms topics and entries into a flat list of { path, content } pairs
// suitable for the GitHub Git Data API.
// Structure: /[topic-name]/[safe-title-or-id].md

export function buildGitHubFileMap(topics, entries) {
  const files = []
  
  for (const topic of topics) {
    const topicEntries = entries.filter((e) => e.topic_id === topic.id)
    const topicPath = safeName(topic.name)
    
    for (const entry of topicEntries) {
      const fileName = `${safeName(entry.title || 'Untitled')}-${entry.id.slice(0, 8)}.md`
      const path = `${topicPath}/${fileName}`
      const content = renderEntryMarkdown(entry)
      files.push({ path, content })
    }
  }
  
  return files
}

function safeName(name) {
  if (!name) return 'Untitled'
  return name.replace(/[\\/:*?"<>|]/g, '-').trim()
}

function renderEntryMarkdown(e) {
  const lines = []
  
  // YAML Frontmatter for metadata preservation
  lines.push('---')
  lines.push(`title: ${JSON.stringify(e.title || '')}`)
  lines.push(`url: ${JSON.stringify(e.url || '')}`)
  lines.push(`status: ${e.status || 'backlog'}`)
  if (e.tags && e.tags.length) {
    lines.push(`tags: [${e.tags.map(t => JSON.stringify(t)).join(', ')}]`)
  }
  lines.push(`created_at: ${e.created_at}`)
  if (e.pinned) lines.push('pinned: true')
  lines.push('---')
  lines.push('')
  
  if (e.url) {
    lines.push(`# [${e.title || e.url}](${e.url})`)
    lines.push('')
  } else if (e.title) {
    lines.push(`# ${e.title}`)
    lines.push('')
  }
  
  if (e.note) {
    lines.push(e.note)
  }
  
  return lines.join('\n')
}

// Helper to parse back a markdown file into an entry object (for Restore)
export function parseEntryMarkdown(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return null
  
  const [, yaml, body] = match
  const metadata = {}
  
  yaml.split('\n').forEach(line => {
    const [key, ...vals] = line.split(':')
    if (!key || !vals.length) return
    const val = vals.join(':').trim()
    try {
      metadata[key.trim()] = JSON.parse(val)
    } catch {
      metadata[key.trim()] = val
    }
  })
  
  // Note: the title/url in the body is redundant but nice for reading.
  // We'll trust the frontmatter for re-importing.
  return {
    ...metadata,
    note: body.trim()
  }
}
