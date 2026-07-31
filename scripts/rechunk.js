#!/usr/bin/env node
// Re-chunk + re-embed the library. Chunks are DERIVED data — run this after
// changing any sizing knob in src/lib/chunkConfig.js.
//   node scripts/rechunk.js            # everything missing/changed
//   node scripts/rechunk.js <entryId>  # one entry
//
// Embeddings are batched per chunk-group (not a 500ms serial drip, which would
// take hours over tens of thousands of chunks).

import { createClient } from '@supabase/supabase-js'
import { chunkContent } from '../src/lib/chunkContent.js'
import { sourcesFor, hashText } from '../src/lib/chunkEntry.js'
import {
  CONTEXTUALIZE_MIN_CHUNKS, CONTEXTUALIZE_BATCH_SIZE, TASK_TYPE_DOCUMENT, EMBED_DIMS,
} from '../src/lib/chunkConfig.js'

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Read .env.local as a fallback so this script sees the same config the app does.
// Real environment variables still win, which keeps it usable in CI.
function readEnvFile(path = '.env.local') {
  try {
    const out = {}
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
    }
    return out
  } catch { return {} }
}
const FILE_ENV = readEnvFile()
const env = (k) => process.env[k] ?? FILE_ENV[k]

const SUPABASE_URL = env('VITE_SUPABASE_URL')
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const AI_BASE_URL = env('AI_BASE_URL')
const AI_API_KEY = env('AI_API_KEY')
const AI_MODEL = env('AI_MODEL')

// Gemini key pool: ~/.gemini-keys (one per line) if present, else GEMINI_API_KEY.
// The free tier is a per-KEY daily quota, so rotating across keys multiplies the
// daily embedding budget — a 429 on one key advances to the next instead of
// stalling the whole backfill.
function loadKeys() {
  const file = join(homedir(), '.gemini-keys')
  if (existsSync(file)) {
    const keys = readFileSync(file, 'utf8')
      .split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean)
      .map((s) => (s.includes('=') ? s.split('=').pop().trim() : s))
      .filter((s) => s.length >= 30)
    if (keys.length) return keys
  }
  return env('GEMINI_API_KEY') ? [env('GEMINI_API_KEY')] : []
}
const GEMINI_KEYS = loadKeys()
let keyIdx = 0

const canContextualize = Boolean(AI_BASE_URL && AI_API_KEY && AI_MODEL)
const ALLOW_NO_CONTEXT = process.argv.includes('--no-context')

// Validated on demand rather than at import time, so other scripts (the
// full_text backfill) can reuse processEntry without this module deciding to
// exit their process for them.
export function requireEnv() {
  for (const [k, v] of Object.entries({ VITE_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })) {
    if (!v) { console.error(`Set ${k}`); process.exit(1) }
  }
  if (!GEMINI_KEYS.length) { console.error('No Gemini key: set GEMINI_API_KEY or create ~/.gemini-keys'); process.exit(1) }
  console.log(`Gemini key pool: ${GEMINI_KEYS.length} key(s)`)
  // A warning was not enough. Chunks written without context are INDISTINGUISHABLE
  // from good ones — same shape, same embedding dimensions, no error — so a
  // scrolled-past warning silently produced 4,971 degraded chunks (found
  // 2026-07-30). Refuse by default; degrading must be an explicit choice.
  if (!canContextualize) {
    if (!ALLOW_NO_CONTEXT) {
      console.error('\nRefusing to run: AI_BASE_URL / AI_API_KEY / AI_MODEL are not set.')
      console.error('Without them, chunks are written WITHOUT contextual retrieval — indistinguishable')
      console.error('from good chunks, so the damage is invisible until you inspect the DB.\n')
      console.error('Fix (recommended): add the three vars to .env.local.')
      console.error('  npx supabase secrets list   # names only — values are hashed;')
      console.error('                              # copy them from your AI provider dashboard\n')
      console.error('Or, if you deliberately want degraded chunks:')
      console.error('  node scripts/rechunk.js --no-context\n')
      process.exit(1)
    }
    console.warn('--no-context: indexing WITHOUT contextual retrieval. Chunks will be lower quality.')
  } else {
    console.log(`Contextual retrieval: ON (${AI_MODEL})`)
  }
}

export const hasEmbeddingKeys = () => GEMINI_KEYS.length > 0

// Lazy so importing this module never constructs a client from missing env.
let _client = null
function db() {
  _client ??= createClient(SUPABASE_URL, SERVICE_KEY)
  return _client
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function embedBatch(texts) {
  const out = []
  for (const text of texts) {
    let embedding = null
    // Retry the per-minute rate limit (429) and transient network errors. On a
    // 429 we ALSO rotate to the next key — a daily-quota 429 won't clear by
    // waiting, so advancing keys is what actually makes progress. Resumable via
    // source_hash, so an eventual give-up is safe.
    let rotationsWithoutProgress = 0
    for (let attempt = 0; attempt < 10 + GEMINI_KEYS.length * 2; attempt++) {
      let res
      try {
        res = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEYS[keyIdx] },
            body: JSON.stringify({
              content: { parts: [{ text }] },
              output_dimensionality: EMBED_DIMS,
              taskType: TASK_TYPE_DOCUMENT,
            }),
          }
        )
      } catch { await sleep(Math.min(30000, 3000 * (attempt + 1))); continue } // network drop
      if (res.ok) { embedding = (await res.json()).embedding.values; break }
      if (res.status === 429) {
        // Move to the next key immediately. Only back off (short) once we've
        // cycled through every key without one accepting the request.
        keyIdx = (keyIdx + 1) % GEMINI_KEYS.length
        if (++rotationsWithoutProgress >= GEMINI_KEYS.length) {
          rotationsWithoutProgress = 0
          await sleep(Math.min(60000, 5000 * (attempt + 1)))
        }
        continue
      }
      throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    if (!embedding) throw new Error('embed failed: retries exhausted (all keys rate-limited or network down)')
    out.push(embedding)
  }
  return out
}

async function askOnce(document, batch) {
  const numbered = batch.map((c, j) => `<chunk index="${j}">\n${c.content}\n</chunk>`).join('\n')
  const prompt = `<document>\n${document}\n</document>\n\nHere are ${batch.length} chunk(s) from the document above:\n${numbered}\n\nFor EACH chunk, give a short succinct context (1-2 sentences, under 100 tokens) situating it within the overall document, to improve search retrieval of that chunk. Do not repeat the chunk. Do not add commentary.\n\nReply with JSON only: {"contexts": ["context for chunk 0", ...]} with exactly ${batch.length} entries in order.`
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You situate excerpts within their source document to improve search retrieval. Reply with JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  const data = await res.json()
  const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
  const contexts = Array.isArray(parsed.contexts) ? parsed.contexts : []
  return batch.map((_, j) => (typeof contexts[j] === 'string' ? contexts[j].trim() : ''))
}

// Mirrors src/lib/contextualize.js — split and retry a short answer rather than
// padding with ''. Kept in sync deliberately: this script and the app must
// produce identically-shaped chunks, or a re-index changes retrieval quality for
// reasons unrelated to the config you were testing.
const MAX_SPLIT_DEPTH = 2
async function contextualizeBatch(document, batch, depth = 0) {
  let out
  try { out = await askOnce(document, batch) } catch { out = batch.map(() => '') }
  if (!out.some((c) => !c) || batch.length < 2 || depth >= MAX_SPLIT_DEPTH) return out
  const mid = Math.ceil(batch.length / 2)
  const retried = [
    ...(await contextualizeBatch(document, batch.slice(0, mid), depth + 1)),
    ...(await contextualizeBatch(document, batch.slice(mid), depth + 1)),
  ]
  return retried.filter(Boolean).length >= out.filter(Boolean).length ? retried : out
}

async function contextualize(document, chunks) {
  if (!canContextualize || chunks.length < CONTEXTUALIZE_MIN_CHUNKS) return chunks.map(() => '')
  const out = []
  for (let i = 0; i < chunks.length; i += CONTEXTUALIZE_BATCH_SIZE) {
    out.push(...(await contextualizeBatch(document, chunks.slice(i, i + CONTEXTUALIZE_BATCH_SIZE))))
  }
  return out
}

export async function processEntry(entry) {
  const sources = sourcesFor(entry)
  const keep = sources.map((s) => s.source)
  const drop = ['full_text', 'note', 'takeaway'].filter((s) => !keep.includes(s))
  if (drop.length) {
    await db().from('content_chunks').delete().eq('entry_id', entry.id).in('source', drop)
  }
  let written = 0
  for (const { source, text, markdown } of sources) {
    const source_hash = hashText(text)
    const { data: existing } = await db()
      .from('content_chunks').select('source_hash')
      .eq('entry_id', entry.id).eq('source', source).limit(1)
    if (existing?.[0]?.source_hash === source_hash) continue

    const chunks = chunkContent(text, { markdown })
    if (!chunks.length) continue

    const contexts = await contextualize(text, chunks)
    const embeddings = await embedBatch(
      chunks.map((c, i) => (contexts[i] ? `${contexts[i]}\n\n${c.content}` : c.content))
    )

    await db().from('content_chunks').delete().eq('entry_id', entry.id).eq('source', source)
    const { error } = await db().from('content_chunks').insert(
      chunks.map((c, i) => ({
        user_id: entry.user_id,
        entry_id: entry.id,
        source,
        position: c.position,
        heading: c.heading ?? null,
        anchor: c.anchor ?? null,
        char_start: c.charStart ?? null,
        content: c.content,
        context: contexts[i] || null,
        word_count: c.wordCount,
        source_hash,
        embedding: embeddings[i],
      }))
    )
    if (error) throw new Error(error.message)
    written += chunks.length
  }
  return written
}

// PostgREST caps a select at 1000 rows, so a single fetch silently drops
// entries past the cap. Page through the whole table. Newest-first so freshly
// imported entries index before any embedding quota runs out.
async function fetchAllEntries(only) {
  if (only) {
    const { data, error } = await db()
      .from('entries').select('id, user_id, note, full_text, takeaway').eq('id', only)
    if (error) { console.error('Fetch failed:', error.message); process.exit(1) }
    return data
  }
  const page = 1000
  const all = []
  for (let from = 0; ; from += page) {
    const { data, error } = await db()
      .from('entries').select('id, user_id, note, full_text, takeaway')
      .is('deleted_at', null).order('created_at', { ascending: false })
      .range(from, from + page - 1)
    if (error) { console.error('Fetch failed:', error.message); process.exit(1) }
    all.push(...data)
    if (data.length < page) break
  }
  return all
}

async function main() {
  requireEnv()
  const only = process.argv[2]
  const entries = await fetchAllEntries(only)

  console.log(`${entries.length} entries to consider`)
  let done = 0, chunks = 0, failed = 0
  for (const entry of entries) {
    try {
      chunks += await processEntry(entry)
      done++
    } catch (e) {
      failed++
      console.error(`\nFailed ${entry.id}: ${e.message}`)
    }
    process.stdout.write(`\r${done}/${entries.length} entries, ${chunks} chunks written, ${failed} failed`)
  }
  console.log(`\nDone. ${done} entries, ${chunks} chunks, ${failed} failed.`)
}

// Only run when invoked directly — backfill-full-text.js imports processEntry.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
