#!/usr/bin/env node
/**
 * Parse the import/ folder and output import-preview.json.
 * Usage: node scripts/parse-import.cjs
 *
 * Handles:
 *   - sortingtabs_organized.md  (pre-categorized URL lists)
 *   - 08 - mocs/*.md            (topic maps of content)
 *   - *.html / *.htm            (Chrome/Firefox bookmark exports)
 *   - *.txt                     (raw tab export, one URL per line)
 *   - other .md files           (imported as full-text note entries)
 *
 * Temporary/junk URLs (AI chats, searches, localhost, login pages) are
 * separated into a `skipped` array — not imported, just reported.
 */

const fs = require('fs')
const path = require('path')

const IMPORT_DIR = path.resolve(__dirname, '..', 'import')
const OUTPUT = path.resolve(__dirname, '..', 'import-preview.json')

// ── Topic tables ─────────────────────────────────────────────────────────────

const MOC_TOPIC = {
  'algos': 'Computer Science',
  'machine learning': 'Machine Learning',
  'getting hired': 'Career',
  'hacking': 'Security',
  'home server': 'Hardware',
  'self hosting': 'Hardware',
  'crypto': 'Finance',
  'futures trading': 'Finance',
  'quant material lectures': 'Finance',
  'fashion': 'Personal',
  'music': 'Personal',
  'photography + videography': 'Personal',
  'training': 'Personal',
  'social skills': 'Personal',
  'inspiration': 'Personal',
  'productivity system': 'Productivity',
  'ee and hardware': 'Hardware',
  'hardware': 'Hardware',
  'digital products': 'Career',
  'work': 'Career',
  'research': 'Resources',
  'learning resources': 'Resources',
  'systems': 'Computer Science',
  'devops': 'Computer Science',
  'db': 'Computer Science',
  'projects': 'Computer Science',
  'chemistry': 'School',
  'big maps': 'Resources',
}

const SECTION_TOPIC = {
  'github': 'Computer Science',
  'ml ai': 'Machine Learning',
  'cp problems': 'Computer Science',
  'docs tutorials': 'Resources',
  'umich': 'School',
  'dev tools': 'Computer Science',
  'jobs': 'Career',
  'courses': 'School',
  'google docs': 'Resources',
  'social': 'Personal',
  'reddit': null,   // classified per-URL by subreddit
  'youtube': null,  // classified per-URL by title
}

const DIR_TOPIC = {
  'thoughts': 'Writing',
  '09 - school': 'School',
  'college': 'School',
  'onmymind': 'Productivity',
  '00 - notes': 'Resources',
}

// ── Classifiers ──────────────────────────────────────────────────────────────

function classifyReddit(url, title) {
  const sub = (url.match(/reddit\.com\/r\/([^/?#]+)/i)?.[1] || '').toLowerCase()
  const ml = ['learnmachinelearning', 'mlquestions', 'machinelearning', 'localllama', 'mcp', 'claudeai']
  const cs = ['csmajors', 'leetcode', 'computerscience', 'programming', 'compsci']
  const career = ['jobs', 'internships', 'cscareerquestions', 'csmajors']
  const finance = ['quant', 'algotrading', 'investing', 'stocks', 'wallstreetbets', 'poker']
  const hw = ['homeserver', 'selfhosted', 'homelab', 'raspberry_pi']
  const fitness = ['bodyweightfitness', 'fitness', 'leangains']
  const school = ['uofm', 'uwaterloo', 'college', 'premed']
  if (ml.includes(sub)) return 'Machine Learning'
  if (career.includes(sub)) return 'Career'
  if (cs.includes(sub)) return 'Computer Science'
  if (finance.includes(sub)) return 'Finance'
  if (hw.includes(sub)) return 'Hardware'
  if (fitness.includes(sub)) return 'Personal'
  if (school.includes(sub)) return 'School'
  const t = (title || '').toLowerCase()
  if (/internship|interview|resume|recruit/.test(t)) return 'Career'
  if (/machine learning|neural|pytorch|llm/.test(t)) return 'Machine Learning'
  if (/algorithm|leetcode|coding/.test(t)) return 'Computer Science'
  return 'Resources'
}

function classifyYouTube(title) {
  const t = (title || '').toLowerCase()
  if (/machine learning|neural|pytorch|tensorflow|llm|ai agent|deep learn|hugging/.test(t)) return 'Machine Learning'
  if (/algorithm|leetcode|dynamic programming|graph algo|binary search|data structure|competitive/.test(t)) return 'Computer Science'
  if (/hack|security|osint|exploit|ctf|malware|reverse engineer|pentest|crack/.test(t)) return 'Security'
  if (/docker|kubernetes|linux kernel|operating system|distributed|database|rust|systems prog/.test(t)) return 'Computer Science'
  if (/invest|trading|stock|crypto|quant|finance|money|poker|kalshi/.test(t)) return 'Finance'
  if (/pcb|electronics|circuit|hardware|verilog|fpga|raspberry|microcontroller/.test(t)) return 'Hardware'
  if (/workout|fitness|basketball|volleyball|posture|muscle|vertical leap/.test(t)) return 'Personal'
  if (/startup|founder|vc|yc y combinator|entrepreneur|business/.test(t)) return 'Career'
  if (/internship|interview|resume|get a job|recruiting/.test(t)) return 'Career'
  if (/study|productivity|note.tak|time manag|obsidian|notion/.test(t)) return 'Productivity'
  return 'Resources'
}

function classifyByUrl(url, title) {
  const u = url.toLowerCase()
  if (/github\.com/.test(u)) return 'Computer Science'
  if (/huggingface\.co|arxiv\.org|openai\.com|anthropic\.com|deepmind\.google/.test(u)) return 'Machine Learning'
  if (/leetcode\.com|codeforces\.com|hackerrank\.com|usaco\.guide/.test(u)) return 'Computer Science'
  if (/reddit\.com/.test(u)) return classifyReddit(url, title)
  if (/youtube\.com|youtu\.be|m\.youtube\.com/.test(u)) return classifyYouTube(title)
  if (/umich\.edu/.test(u)) return 'School'
  if (/jane\s*street|peak6|aquatic|citadel|hudson\s*river|quant/.test(title || '')) return 'Finance'
  return null
}

// ── Temporary URL detection ───────────────────────────────────────────────────

const TEMP_PATTERNS = [
  // AI chat sessions — saved tabs from conversations, not resources
  /claude\.ai\/chat\//,
  /chatgpt\.com\/c\//,
  /perplexity\.ai\/search\//,
  /gemini\.google\.com\/app\//,
  // Search queries — one-time, no lasting value
  /google\.com\/search\?/,
  /bing\.com\/search\?/,
  // Local / personal dashboards
  /^https?:\/\/localhost/,
  /supabase\.com\/dashboard\//,
  /openrouter\.ai\/workspaces\//,
  // Email / calendar — not resources
  /mail\.google\.com\//,
  /outlook\.office\.com\//,
  /calendar\.google\.com\//,
  // SSO / login pages
  /login\.microsoftonline\.com\//,
  /identity\.elluciancloud\.com\//,
  /authenticationendpoint\/saml/,
  // One-time form submissions / event RSVPs
  /paxel\.ycombinator\.com\/(?:auth|results)/,
  /forms\.zohopublic\.com\//,
  // College LMS / portals — session-bound
  /classes\.iwcc\.edu\//,
  /iwcc-ss\.colleague\./,
  /bibliu\.com\/app\//,
  /csprod\.dsc\.umich\.edu\//,
  // Drive files (personal, not reference links)
  /drive\.google\.com\/(drive|file)\//,
]

function isTemporary(url) {
  if (!url) return false
  return TEMP_PATTERNS.some((re) => re.test(url))
}

// ── URL utilities ─────────────────────────────────────────────────────────────

const TRACKING = [/[?&]fbclid=[^&]*/g, /[?&]utm_[^&]*/g, /[?&]ref=[^&]*/g, /[?&]_branch[^&]*/g]

function normalizeUrl(url) {
  if (!url) return null
  let u = url.trim()
  for (const re of TRACKING) u = u.replace(re, '')
  return u.replace(/[?&]$/, '').replace(/\?$/, '')
}

function isHttpUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim())
}

// Extract {title, url} pairs from markdown text
function extractMarkdownUrls(text) {
  const results = []
  // [title](url)
  const md = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g
  let m
  while ((m = md.exec(text)) !== null) {
    results.push({ title: m[1].trim() || null, url: m[2].trim() })
  }
  // bare https:// URLs not already captured
  const captured = new Set(results.map(r => r.url))
  const raw = /(?<![("'\[])https?:\/\/[^\s\])"'<>,]+/g
  while ((m = raw.exec(text)) !== null) {
    const u = m[0].replace(/[.,;:!?]+$/, '')
    if (!captured.has(u)) { results.push({ title: null, url: u }); captured.add(u) }
  }
  return results
}

// ── File parsers ─────────────────────────────────────────────────────────────

function parseSortingTabs(text, relPath) {
  const entries = []
  let sectionTopic = 'Resources'
  let sectionName = ''

  for (const raw of text.split('\n')) {
    const line = raw.trim()

    // ## Section Name (N)
    const secMatch = line.match(/^## (.+?)(?:\s*\(\d+\))?\s*$/)
    if (secMatch) {
      sectionName = secMatch[1].trim()
      const key = sectionName.toLowerCase().replace(/[^a-z ]/g, ' ').trim().replace(/\s+/g, ' ')
      sectionTopic = SECTION_TOPIC[key] ?? 'Resources'
      continue
    }

    // - [Title](url)
    const listLink = line.match(/^[-*]\s+\[([^\]]*)\]\((https?:\/\/[^)]+)\)/)
    if (listLink) {
      let title = listLink[1].trim()
      const url = listLink[2].trim()
      // Strip site suffix "Title | Site" or "Title · Site" or "Title \ Site"
      title = title.replace(/\s*[·|\\:]\s*.{1,40}$/, '').trim() || null
      let topic = sectionTopic
      if (!topic) {
        // Reddit or YouTube sections need per-item classification
        if (/reddit\.com/.test(url)) topic = classifyReddit(url, title || '')
        else if (/youtube|youtu\.be/.test(url)) topic = classifyYouTube(title || '')
        else topic = classifyByUrl(url, title || '') || 'Resources'
      }
      entries.push({ url, title, note: '', suggested_topic: topic, source: relPath })
      continue
    }

    // - bare URL
    const listUrl = line.match(/^[-*]\s+(https?:\/\/\S+)/)
    if (listUrl) {
      const url = listUrl[1]
      const topic = sectionTopic || classifyByUrl(url, '') || 'Resources'
      entries.push({ url, title: null, note: '', suggested_topic: topic, source: relPath })
    }
  }

  return entries
}

function parseMOC(text, relPath) {
  const filename = path.basename(relPath, path.extname(relPath)).toLowerCase()
  const topic = MOC_TOPIC[filename] || 'Resources'

  // Strip YAML frontmatter
  const body = text.replace(/^---[\s\S]*?---\n?/, '')

  return extractMarkdownUrls(body)
    .filter(({ url }) => isHttpUrl(url) && !/Pasted image/.test(url))
    .map(({ url, title }) => ({ url, title, note: '', suggested_topic: topic, source: relPath }))
}

function parseDocument(text, relPath, defaultTopic) {
  const body = text.replace(/^---[\s\S]*?---\n?/, '').trim()
  if (!body) return []

  // Derive title from first heading or filename
  const headingMatch = body.match(/^#+\s+(.+)/m)
  const title = headingMatch
    ? headingMatch[1].trim()
    : path.basename(relPath, path.extname(relPath))

  return [{
    url: null,
    title,
    note: body.slice(0, 8000),
    suggested_topic: defaultTopic,
    source: relPath,
    is_document: true,
  }]
}

function parseBookmarkHTML(text, filename) {
  const entries = []
  const folderStack = []
  let currentFolder = ''

  for (const line of text.split('\n')) {
    // Folder open <H3>name</H3>
    const h3 = line.match(/<H3[^>]*>([^<]+)<\/H3>/i)
    if (h3) {
      currentFolder = h3[1].trim()
      folderStack.push(currentFolder)
      continue
    }
    // Folder close </DL>
    if (/<\/DL>/i.test(line)) {
      folderStack.pop()
      currentFolder = folderStack[folderStack.length - 1] || ''
      continue
    }
    // Link
    const a = line.match(/<A\s+HREF="([^"]+)"[^>]*>([^<]*)<\/A>/i)
    if (!a) continue
    const url = a[1]
    if (!isHttpUrl(url)) continue
    const title = a[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").trim() || null
    const topic = inferBookmarkTopic(url, title, folderStack)
    entries.push({ url, title, note: '', suggested_topic: topic, source: filename })
  }

  return entries
}

function inferBookmarkTopic(url, title, folderStack) {
  const folders = folderStack.join(' ').toLowerCase()
  if (/machine learning|artificial intel|deep learn|ml\/ai/i.test(folders)) return 'Machine Learning'
  if (/career|job|recruit|intern|hiring/i.test(folders)) return 'Career'
  if (/finance|quant|trading|crypto|invest/i.test(folders)) return 'Finance'
  if (/hardware|electronics|iot|pcb|ee/i.test(folders)) return 'Hardware'
  if (/school|umich|university|course|academic/i.test(folders)) return 'School'
  if (/security|hack|ctf|pentest/i.test(folders)) return 'Security'
  if (/productivity|system|workflow/i.test(folders)) return 'Productivity'
  if (/computer science|programming|dev|software|algorithm/i.test(folders)) return 'Computer Science'
  // Fall back to URL/title inference
  return classifyByUrl(url, title) || 'Resources'
}

function parseTxtTabs(text, relPath) {
  const entries = []
  for (const raw of text.split('\n')) {
    const url = raw.trim()
    if (!isHttpUrl(url)) continue
    const topic = classifyByUrl(url, '') || 'Resources'
    entries.push({ url, title: null, note: '', suggested_topic: topic, source: relPath })
  }
  return entries
}

// ── Directory walker ──────────────────────────────────────────────────────────

function topicForDir(relDir) {
  const parts = relDir.toLowerCase().split(path.sep)
  for (const part of parts) {
    for (const [key, topic] of Object.entries(DIR_TOPIC)) {
      if (part.includes(key)) return topic
    }
  }
  return 'Resources'
}

function walkDir(dir, all = [], depth = 0) {
  if (depth > 4) return all

  for (const name of fs.readdirSync(dir)) {
    if (name === 'README.md') continue
    const fullPath = path.join(dir, name)
    const relPath = path.relative(IMPORT_DIR, fullPath)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      walkDir(fullPath, all, depth + 1)
      continue
    }

    const ext = path.extname(name).toLowerCase()

    // ── Markdown ─────────────────────────────────────────────────────────────
    if (ext === '.md') {
      const text = fs.readFileSync(fullPath, 'utf8')
      const relDir = path.relative(IMPORT_DIR, dir)

      // sortingtabs: special pre-categorized URL list
      if (name === 'sortingtabs_organized.md') {
        all.push(...parseSortingTabs(text, relPath))
        continue
      }

      // 08 - mocs: Map-of-Content files → extract URLs
      if (relDir.includes('08 - mocs') || relDir.includes('08-mocs')) {
        all.push(...parseMOC(text, relPath))
        continue
      }

      // Everything else → document import
      const defaultTopic = topicForDir(relDir)
      all.push(...parseDocument(text, relPath, defaultTopic))
      continue
    }

    // ── Plain-text tab exports ────────────────────────────────────────────────
    if (ext === '.txt') {
      const text = fs.readFileSync(fullPath, 'utf8')
      all.push(...parseTxtTabs(text, relPath))
      continue
    }

    // ── HTML bookmarks ────────────────────────────────────────────────────────
    if (ext === '.html' || ext === '.htm') {
      process.stdout.write(`  Parsing ${name} (${Math.round(stat.size / 1024)}KB)… `)
      const text = fs.readFileSync(fullPath, 'utf8')
      const parsed = parseBookmarkHTML(text, relPath)
      process.stdout.write(`${parsed.length} links\n`)
      all.push(...parsed)
    }
  }

  return all
}

// ── Dedup + build output ──────────────────────────────────────────────────────

console.log(`\nParsing import/ folder…\n`)
const raw = walkDir(IMPORT_DIR)
console.log(`\nRaw entries: ${raw.length}`)

const seen = new Set()
const entries = []
const skipped = []
let dups = 0

for (const e of raw) {
  if (e.url) {
    const norm = normalizeUrl(e.url)
    if (seen.has(norm)) { dups++; continue }
    seen.add(norm)

    if (isTemporary(norm)) {
      skipped.push({ url: norm, title: e.title, source: e.source })
      continue
    }

    entries.push({ ...e, url: norm })
  } else {
    const key = `doc:${e.title}`
    if (seen.has(key)) { dups++; continue }
    seen.add(key)
    entries.push(e)
  }
}

const topics = [...new Set(entries.map(e => e.suggested_topic))].sort()
const byTopic = Object.fromEntries(topics.map(t => [t, entries.filter(e => e.suggested_topic === t).length]))

const output = {
  generated: new Date().toISOString(),
  stats: {
    files_parsed: [...new Set(raw.map(e => e.source))].length,
    raw: raw.length,
    duplicates_removed: dups,
    temp_skipped: skipped.length,
    total: entries.length,
    by_topic: byTopic,
  },
  suggested_topics: topics,
  entries,
  skipped,
}

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2))

console.log(`Duplicates removed: ${dups}`)
console.log(`Temp/junk skipped:  ${skipped.length}`)
console.log(`\nFinal: ${entries.length} entries → import-preview.json`)
console.log('\nBy topic:')
for (const [t, n] of Object.entries(byTopic)) {
  console.log(`  ${String(n).padStart(4)}  ${t}`)
}
console.log('\nNext: load import-preview.json in the app via Smart Import.')
