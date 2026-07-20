#!/usr/bin/env node
// Distill AI conversations into MediaLog entries.
//
// Conversations are the densest source of your own thinking, but raw transcripts
// are mostly tool calls, command output and filler. This strips that down to the
// reasoning, emits one markdown document per conversation, and stops there —
// review the output, then import, then let scripts/rechunk.js chunk + embed it.
//
//   node scripts/distill-conversations.mjs --source claude-code
//   node scripts/distill-conversations.mjs --source claude-code --project medialog
//   node scripts/distill-conversations.mjs --source claude-ai --input ~/Downloads/conversations.json
//   node scripts/distill-conversations.mjs --source claude-code --import   # write entries to DB
//
// Default is a DRY RUN to --out (no DB writes). Import only what reads well.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { chunkContent } from '../src/lib/chunkContent.js'
import { MAX_CHUNKS_PER_SOURCE } from '../src/lib/chunkConfig.js'

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : (argv[i + 1]?.startsWith('--') ? true : argv[i + 1] ?? true)
}
const has = (name) => argv.includes(`--${name}`)

const SOURCE = flag('source', 'claude-code')
const PROJECT = flag('project')            // substring filter on project dir
const INPUT = flag('input')                // claude.ai conversations.json
const OUT = flag('out', 'distilled')
const DO_IMPORT = has('import')
const LIMIT = Number(flag('limit', 0)) || 0

// Quality gates — a conversation must clear these to be worth embedding.
const MIN_EXCHANGES = Number(flag('min-exchanges', 2))
const MIN_WORDS = Number(flag('min-words', 150))

// ---------------------------------------------------------------- denoise

// Harness/tooling wrappers that are never the user's thinking.
const NOISE_TAGS = [
  'system-reminder', 'local-command-caveat', 'command-name', 'command-message',
  'command-args', 'command-contents', 'bash-stdout', 'bash-stderr',
  'user-prompt-submit-hook', 'function_results', 'session_knowledge',
  'context_window_protection', 'EXTREMELY_IMPORTANT', 'session-notes',
]

const FILLER = /^(y|yes|ok|okay|k|go|go ahead|do it|sure|continue|cont|next|proceed|thanks|ty|yep|yeah|nice|perfect|great|lgtm|approved?|ship it|fix it|try again|again|and\?|\?+|\.+)\W*$/i

// Skill/plugin invocation boilerplate the harness injects as a "user" turn. It
// is machinery, not the user talking, and it hijacks conversation titles.
const PREAMBLE = /^(base directory for this skill|you have superpowers|<?name:\s|the following skills are available|skill:\s)/i

function stripNoise(text) {
  let t = String(text ?? '')
  for (const tag of NOISE_TAGS) {
    // paired form, then any stray open/close
    t = t.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), ' ')
    t = t.replace(new RegExp(`</?${tag}[^>]*>`, 'gi'), ' ')
  }
  t = t.replace(/<[\s\S]*?>/gi, ' ')
  // Caveat preamble the harness prepends to local-command output.
  t = t.replace(/^Caveat: The messages below[\s\S]*?$/gim, ' ')
  return t.trim()
}

// Long code fences are implementation, not reasoning. Keep short ones (they
// often carry the point); collapse long ones so they don't dominate a chunk.
function collapseCode(text, maxLines = 8) {
  return text.replace(/```[\w-]*\n([\s\S]*?)```/g, (m, body) => {
    const lines = body.split('\n')
    return lines.length <= maxLines ? m : `\`[${lines.length} lines of code omitted]\``
  })
}

// Pasted file dumps / stack traces masquerading as prose.
function looksLikeDump(text) {
  const lines = text.split('\n')
  if (lines.length < 8) return false
  const pathish = lines.filter((l) => /^\s*(\d+[→:|]|[A-Za-z]:[\\/]|\.{0,2}\/|at\s+\w+)/.test(l)).length
  return pathish / lines.length > 0.5
}

const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)

function cleanTurn(role, raw) {
  let t = stripNoise(raw)
  if (!t) return null
  if (role === 'assistant') t = collapseCode(t)
  t = t.replace(/\n{3,}/g, '\n\n').trim()
  if (!t) return null
  if (looksLikeDump(t)) return null
  if (role === 'user' && FILLER.test(t)) return null
  if (role === 'user' && PREAMBLE.test(t)) return null
  if (role === 'user' && words(t) < 4) return null
  if (role === 'assistant' && words(t) < 25) return null
  return t
}

// ---------------------------------------------------------------- adapters
// Each adapter yields: { id, title, project, startedAt, turns: [{role, text}] }

function* readClaudeCode() {
  const base = path.join(os.homedir(), '.claude', 'projects')
  if (!fs.existsSync(base)) throw new Error(`No transcripts at ${base}`)
  let dirs = fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory())
  if (PROJECT && PROJECT !== true) dirs = dirs.filter((d) => d.toLowerCase().includes(String(PROJECT).toLowerCase()))

  for (const dir of dirs) {
    const full = path.join(base, dir)
    for (const f of fs.readdirSync(full).filter((f) => f.endsWith('.jsonl'))) {
      const turns = []
      let startedAt = null
      for (const line of fs.readFileSync(path.join(full, f), 'utf8').split('\n')) {
        if (!line.trim()) continue
        let o
        try { o = JSON.parse(line) } catch { continue }
        if (!startedAt && o.timestamp) startedAt = o.timestamp
        const m = o.message
        if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
        // Only text blocks — tool_use / tool_result are dropped wholesale.
        const text = typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
            : ''
        if (text.trim()) turns.push({ role: m.role, text })
      }
      if (turns.length) {
        yield {
          id: path.basename(f, '.jsonl'),
          title: null,
          project: dir.replace(/^C--Users-\w+-/, '').replace(/-/g, ' ').trim(),
          startedAt,
          turns,
        }
      }
    }
  }
}

function* readClaudeAi() {
  if (!INPUT || INPUT === true) throw new Error('--source claude-ai needs --input <conversations.json>')
  const file = String(INPUT).replace(/^~/, os.homedir())
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const list = Array.isArray(data) ? data : data.conversations ?? []
  for (const c of list) {
    const msgs = c.chat_messages ?? c.messages ?? []
    const turns = []
    for (const m of msgs) {
      const role = (m.sender ?? m.role) === 'human' ? 'user' : (m.sender ?? m.role)
      if (role !== 'user' && role !== 'assistant') continue
      // Export puts text either on .text or in a content[] block array.
      const text = m.text?.trim()
        ? m.text
        : Array.isArray(m.content)
          ? m.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
          : ''
      if (text.trim()) turns.push({ role, text })
    }
    if (turns.length) {
      yield {
        id: c.uuid ?? c.id ?? String(turns.length),
        title: c.name?.trim() || null,
        project: 'claude.ai',
        startedAt: c.created_at ?? null,
        turns,
      }
    }
  }
}

// ---------------------------------------------------------------- distill

// Pair each user turn with the assistant reply that follows it. The Q/A shape is
// what makes a conversation retrievable — a wall of prose is not.
function toExchanges(turns) {
  const cleaned = []
  for (const t of turns) {
    const text = cleanTurn(t.role, t.text)
    if (text) cleaned.push({ role: t.role, text })
  }
  const out = []
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i].role !== 'user') continue
    const q = cleaned[i].text
    const answers = []
    for (let j = i + 1; j < cleaned.length && cleaned[j].role === 'assistant'; j++) {
      answers.push(cleaned[j].text)
    }
    if (answers.length) out.push({ q, a: answers.join('\n\n') })
  }
  return out
}

// Headings drive chunkContent's markdown mode, so they must be meaningful.
function headingFor(question) {
  const first = question.split('\n').find((l) => l.trim()) ?? question
  const clean = first.replace(/[#*`_>\[\]]/g, '').replace(/\s+/g, ' ').trim()
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean
}

function render(conv, exchanges, part = null, ofParts = null) {
  const base = conv.title ?? headingFor(exchanges[0].q)
  const title = ofParts > 1 ? `${base} (part ${part}/${ofParts})` : base
  const date = conv.startedAt ? String(conv.startedAt).slice(0, 10) : 'unknown date'
  const body = exchanges
    .map(({ q, a }) => `## ${headingFor(q)}\n\n**Asked:** ${q.trim()}\n\n${a.trim()}`)
    .join('\n\n')
  return {
    title: title.length > 120 ? `${title.slice(0, 117)}…` : title,
    date,
    markdown: `# ${title}\n\n_${conv.project} · ${date}_\n\n${body}\n`,
  }
}

// A resumed/forked session replays its parent's history, so the same exchanges
// arrive several times. Keep the longest copy and drop anything largely covered
// by it — duplicates would otherwise crowd every retrieval result.
function dedupe(convs, overlap = 0.7) {
  const fp = (q) => q.replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase()
  const seenFps = new Set()
  const out = []
  for (const c of convs) {
    const fps = c.exchangeList.map((e) => fp(e.q))
    const dupes = fps.filter((f) => seenFps.has(f)).length
    if (fps.length && dupes / fps.length >= overlap) continue
    fps.forEach((f) => seenFps.add(f))
    out.push(c)
  }
  return out
}

// chunkContent hard-caps at MAX_CHUNKS_PER_SOURCE, so an oversized conversation
// would lose its tail entirely. Split it across entries instead of truncating.
function splitOversized(conv) {
  const all = conv.exchangeList
  const probe = chunkContent(render(conv, all).markdown, { markdown: true })
  if (probe.length < MAX_CHUNKS_PER_SOURCE) return [{ conv, exchanges: all }]

  const parts = Math.ceil(probe.length / (MAX_CHUNKS_PER_SOURCE * 0.75))
  const per = Math.ceil(all.length / parts)
  const out = []
  for (let i = 0; i < all.length; i += per) out.push(all.slice(i, i + per))
  return out.map((exchanges) => ({ conv, exchanges, ofParts: out.length }))
}

// ---------------------------------------------------------------- run

function main() {
  const reader = SOURCE === 'claude-ai' ? readClaudeAi : readClaudeCode
  const candidates = []
  let seen = 0, droppedGate = 0, droppedEmpty = 0

  for (const conv of reader()) {
    seen++
    const exchangeList = toExchanges(conv.turns)
    if (!exchangeList.length) { droppedEmpty++; continue }
    const wc = words(render(conv, exchangeList).markdown)
    if (exchangeList.length < MIN_EXCHANGES || wc < MIN_WORDS) { droppedGate++; continue }
    candidates.push({ ...conv, exchangeList, wordCount: wc })
  }

  // Longest first, so dedupe keeps the most complete copy of a resumed session.
  candidates.sort((a, b) => b.wordCount - a.wordCount)
  const unique = dedupe(candidates)
  const droppedDupe = candidates.length - unique.length

  const kept = []
  for (const conv of unique) {
    for (const [i, piece] of splitOversized(conv).entries()) {
      const doc = render(conv, piece.exchanges, i + 1, piece.ofParts ?? 1)
      kept.push({
        ...conv, ...doc,
        exchanges: piece.exchanges.length,
        wordCount: words(doc.markdown),
      })
    }
    if (LIMIT && kept.length >= LIMIT) break
  }
  const split = kept.length - unique.length

  const outDir = path.resolve(OUT)
  fs.mkdirSync(outDir, { recursive: true })
  const manifest = []
  let totalChunks = 0

  for (const k of kept) {
    const slug = k.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || k.id
    const file = `${k.date}-${slug}.md`
    fs.writeFileSync(path.join(outDir, file), k.markdown, 'utf8')
    // Preview how this will actually chunk, using the real chunker.
    const chunks = chunkContent(k.markdown, { markdown: true })
    totalChunks += chunks.length
    manifest.push({
      file, title: k.title, project: k.project, date: k.date,
      exchanges: k.exchanges, words: k.wordCount, chunks: chunks.length,
    })
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  const chunkWords = kept.flatMap((k) => chunkContent(k.markdown, { markdown: true }).map((c) => c.wordCount))
  chunkWords.sort((a, b) => a - b)
  const median = chunkWords[Math.floor(chunkWords.length / 2)] ?? 0

  console.log(`source:            ${SOURCE}${PROJECT && PROJECT !== true ? ` (project~${PROJECT})` : ''}`)
  console.log(`conversations:     ${seen} seen → ${kept.length} entries`)
  console.log(`  dropped (noise):  ${droppedEmpty} had no substantive exchange`)
  console.log(`  dropped (gate):   ${droppedGate} below ${MIN_EXCHANGES} exchanges / ${MIN_WORDS} words`)
  console.log(`  dropped (dupe):   ${droppedDupe} resumed sessions covered by a longer copy`)
  console.log(`  split (oversize): +${split} extra parts past the ${MAX_CHUNKS_PER_SOURCE}-chunk cap`)
  console.log(`chunks (previewed): ${totalChunks}, median ${median} words`)
  console.log(`written to:        ${outDir}/  (+ manifest.json)`)
  if (kept.length) {
    console.log('\ntop conversations by size:')
    for (const m of manifest.slice(0, 10)) {
      console.log(`  ${String(m.chunks).padStart(3)} chunks  ${String(m.words).padStart(6)}w  ${m.title.slice(0, 62)}`)
    }
  }
  if (DO_IMPORT) {
    console.log('\n--import is not wired yet — review the markdown above first, then we wire it.')
  } else {
    console.log('\nDry run. Review the .md files, then re-run with --import.')
  }
}

main()
