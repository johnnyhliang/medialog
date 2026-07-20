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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const AI_BASE_URL = process.env.AI_BASE_URL
const AI_API_KEY = process.env.AI_API_KEY
const AI_MODEL = process.env.AI_MODEL

for (const [k, v] of Object.entries({ VITE_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, GEMINI_API_KEY })) {
  if (!v) { console.error(`Set ${k}`); process.exit(1) }
}
const canContextualize = Boolean(AI_BASE_URL && AI_API_KEY && AI_MODEL)
if (!canContextualize) {
  console.warn('AI_BASE_URL/AI_API_KEY/AI_MODEL not set — indexing WITHOUT contextual retrieval (lower quality).')
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function embedBatch(texts) {
  const out = []
  for (const text of texts) {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          output_dimensionality: EMBED_DIMS,
          taskType: TASK_TYPE_DOCUMENT,
        }),
      }
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = await res.json()
    out.push(data.embedding.values)
  }
  return out
}

async function contextualize(document, chunks) {
  if (!canContextualize || chunks.length < CONTEXTUALIZE_MIN_CHUNKS) return chunks.map(() => '')
  const out = []
  for (let i = 0; i < chunks.length; i += CONTEXTUALIZE_BATCH_SIZE) {
    const batch = chunks.slice(i, i + CONTEXTUALIZE_BATCH_SIZE)
    const numbered = batch.map((c, j) => `<chunk index="${j}">\n${c.content}\n</chunk>`).join('\n')
    const prompt = `<document>\n${document}\n</document>\n\nHere are ${batch.length} chunk(s) from the document above:\n${numbered}\n\nFor EACH chunk, give a short succinct context (1-2 sentences, under 100 tokens) situating it within the overall document, to improve search retrieval of that chunk. Do not repeat the chunk. Do not add commentary.\n\nReply with JSON only: {"contexts": ["context for chunk 0", ...]} with exactly ${batch.length} entries in order.`
    try {
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
      out.push(...batch.map((_, j) => (typeof contexts[j] === 'string' ? contexts[j].trim() : '')))
    } catch {
      out.push(...batch.map(() => ''))
    }
  }
  return out
}

async function processEntry(entry) {
  const sources = sourcesFor(entry)
  const keep = sources.map((s) => s.source)
  const drop = ['full_text', 'note', 'takeaway'].filter((s) => !keep.includes(s))
  if (drop.length) {
    await supabase.from('content_chunks').delete().eq('entry_id', entry.id).in('source', drop)
  }
  let written = 0
  for (const { source, text, markdown } of sources) {
    const source_hash = hashText(text)
    const { data: existing } = await supabase
      .from('content_chunks').select('source_hash')
      .eq('entry_id', entry.id).eq('source', source).limit(1)
    if (existing?.[0]?.source_hash === source_hash) continue

    const chunks = chunkContent(text, { markdown })
    if (!chunks.length) continue

    const contexts = await contextualize(text, chunks)
    const embeddings = await embedBatch(
      chunks.map((c, i) => (contexts[i] ? `${contexts[i]}\n\n${c.content}` : c.content))
    )

    await supabase.from('content_chunks').delete().eq('entry_id', entry.id).eq('source', source)
    const { error } = await supabase.from('content_chunks').insert(
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
    const { data, error } = await supabase
      .from('entries').select('id, user_id, note, full_text, takeaway').eq('id', only)
    if (error) { console.error('Fetch failed:', error.message); process.exit(1) }
    return data
  }
  const page = 1000
  const all = []
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
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

main()
