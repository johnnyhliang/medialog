import GithubSlugger from 'github-slugger'
import { MIN_WORDS, MAX_WORDS, TARGET_WORDS, OVERLAP_RATIO, MAX_CHUNKS_PER_SOURCE } from './chunkConfig.js'

const countWords = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)

function stripInline(s) {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Split a long body into overlapping word windows.
function windowSplit(text, baseCharStart) {
  const tokens = text.trim().split(/\s+/)
  if (!tokens.length) return []
  const step = Math.max(1, Math.round(TARGET_WORDS * (1 - OVERLAP_RATIO)))
  const out = []
  for (let i = 0; i < tokens.length; i += step) {
    const slice = tokens.slice(i, i + MAX_WORDS)
    if (!slice.length) break
    const content = slice.join(' ')
    // charStart is approximate for windows: offset of this window's first token
    const before = tokens.slice(0, i).join(' ')
    out.push({
      content,
      wordCount: slice.length,
      charStart: baseCharStart + (before ? before.length + 1 : 0),
    })
    if (i + MAX_WORDS >= tokens.length) break
  }
  return out
}

// Parse markdown into { heading, anchor, body, charStart } sections.
function markdownSections(text) {
  const slugger = new GithubSlugger()
  const lines = text.split('\n')
  const sections = []
  let cur = { heading: null, anchor: null, lines: [], charStart: 0 }
  let offset = 0
  let inFence = false

  for (const raw of lines) {
    const line = raw.trim()
    const lineLen = raw.length + 1
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence
      cur.lines.push(raw)
      offset += lineLen
      continue
    }
    const m = !inFence && line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (m) {
      if (cur.lines.join('\n').trim() || cur.heading) sections.push(cur)
      const heading = stripInline(m[2])
      cur = { heading, anchor: slugger.slug(heading), lines: [], charStart: offset }
    } else {
      cur.lines.push(raw)
    }
    offset += lineLen
  }
  if (cur.lines.join('\n').trim() || cur.heading) sections.push(cur)

  return sections
    .map((s) => ({ ...s, body: s.lines.join('\n').trim() }))
    .filter((s) => s.body || s.heading)
}

export function chunkContent(text, { markdown = false } = {}) {
  const src = String(text ?? '')
  if (!src.trim()) return []

  const raw = []

  if (markdown) {
    const sections = markdownSections(src)
    // Merge undersized sections forward so no tiny, score-distorting chunks emit.
    const merged = []
    let pending = null
    for (const s of sections) {
      const combined = pending
        ? { ...pending, body: `${pending.body}\n\n${s.heading ? `${s.heading}\n` : ''}${s.body}`.trim() }
        : { ...s, body: s.heading ? `${s.heading}\n${s.body}`.trim() : s.body }
      if (countWords(combined.body) < MIN_WORDS) { pending = combined; continue }
      merged.push(combined)
      pending = null
    }
    if (pending) {
      if (merged.length) {
        const last = merged[merged.length - 1]
        last.body = `${last.body}\n\n${pending.body}`.trim()
      } else {
        merged.push(pending)
      }
    }

    for (const s of merged) {
      if (countWords(s.body) <= MAX_WORDS) {
        raw.push({ heading: s.heading, anchor: s.anchor, content: s.body, wordCount: countWords(s.body), charStart: s.charStart })
      } else {
        for (const w of windowSplit(s.body, s.charStart)) {
          raw.push({ heading: s.heading, anchor: s.anchor, ...w })
        }
      }
    }
  } else {
    for (const w of windowSplit(src, 0)) {
      raw.push({ heading: null, anchor: null, ...w })
    }
  }

  return raw
    .filter((c) => c.content.trim())
    .slice(0, MAX_CHUNKS_PER_SOURCE)
    .map((c, i) => ({ ...c, position: i }))
}
