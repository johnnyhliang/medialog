import JSZip from 'jszip'

// Returns Array<{ title, url, note, suggestedTopic }>

function extractUrl(line) {
  // Handles bare URLs and OneTab/tab-manager "Title - url" format
  const trimmed = line.trim()
  if (!trimmed) return null
  // Try bare URL first
  if (isUrl(trimmed)) return { url: trimmed, title: '' }
  // Try "anything - url" — find last URL-shaped token
  const match = trimmed.match(/^(.*?)\s+-\s+(https?:\/\/\S+)$/)
  if (match) return { url: match[2], title: match[1].trim() }
  // Try tab-separated (some exporters use TSV)
  const parts = trimmed.split('\t')
  for (const p of parts) {
    if (isUrl(p.trim())) return { url: p.trim(), title: parts.find((x) => x !== p)?.trim() || '' }
  }
  return null
}

function isUrl(s) {
  if (/\s/.test(s)) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

export function parseTabs(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const extracted = extractUrl(line)
      if (!extracted) return []
      return [{ url: extracted.url, title: extracted.title || '', note: '', suggestedTopic: '' }]
    })
}

export function parseAppleNotesHtml(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const results = []

  // Apple Notes exports each note as a <div class="note"> containing <h1> and content
  const notes = doc.querySelectorAll('.note, section, article')
  if (notes.length > 0) {
    for (const note of notes) {
      const h1 = note.querySelector('h1')
      const title = h1?.textContent?.trim() || ''
      h1?.remove()
      const body = note.textContent.trim()
      const urls = [...body.matchAll(/https?:\/\/\S+/g)].map((m) => m[0])
      if (urls.length > 0) {
        for (const url of urls) {
          results.push({ url, title, note: body.replace(url, '').trim(), suggestedTopic: '' })
        }
      } else if (body) {
        results.push({ url: null, title, note: body, suggestedTopic: '' })
      }
    }
  } else {
    // Fallback: extract all links
    for (const a of doc.querySelectorAll('a[href]')) {
      const url = a.href
      if (!isUrl(url)) continue
      results.push({ url, title: a.textContent.trim() || '', note: '', suggestedTopic: '' })
    }
    // Also extract bare-text paragraphs with no links
    for (const p of doc.querySelectorAll('p, div')) {
      if (p.querySelector('a')) continue
      const text = p.textContent.trim()
      if (text) results.push({ url: null, title: '', note: text, suggestedTopic: '' })
    }
  }
  return results
}

export function parseKeepJson(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  // Google Keep Takeout: top-level array or { notes: [...] }
  const notes = Array.isArray(data) ? data : data.notes ?? []
  return notes.flatMap((note) => {
    if (note.isTrashed) return []
    const title = note.title?.trim() || ''
    const body = (note.textContent || note.text || '').trim()
    const urls = [...(body + ' ' + title).matchAll(/https?:\/\/\S+/g)].map((m) => m[0])
    if (urls.length > 0) {
      return urls.map((url) => ({ url, title, note: body, suggestedTopic: '' }))
    }
    if (body || title) {
      return [{ url: null, title, note: body, suggestedTopic: '' }]
    }
    return []
  })
}

export async function parseObsidianZip(file) {
  const zip = await JSZip.loadAsync(file)
  const results = []
  const files = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.endsWith('.md') && !f.name.startsWith('__MACOSX')
  )
  for (const f of files) {
    const content = await f.async('text')
    // Parse frontmatter
    let body = content
    let frontmatterTags = []
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
    if (fmMatch) {
      body = content.slice(fmMatch[0].length)
      const tagsMatch = fmMatch[1].match(/tags:\s*\[([^\]]+)\]/)
      if (tagsMatch) frontmatterTags = tagsMatch[1].split(',').map((t) => t.trim().replace(/^["']|["']$/g, ''))
    }
    // Derive topic from path: "AI/paper-notes.md" → "AI"
    const parts = f.name.split('/')
    const suggestedTopic = parts.length > 1 ? parts[0] : ''
    const fileName = parts[parts.length - 1].replace(/\.md$/, '')
    // Strip wikilinks
    const cleanBody = body.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').trim()
    // Extract first URL if present
    const urlMatch = cleanBody.match(/https?:\/\/\S+/)
    const url = urlMatch ? urlMatch[0] : null
    const note = url ? cleanBody.replace(url, '').trim() : cleanBody
    results.push({
      url,
      title: fileName,
      note: note.slice(0, 2000),
      suggestedTopic,
      tags: frontmatterTags,
    })
  }
  return results
}
