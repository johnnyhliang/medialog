#!/usr/bin/env node
// Run: node scripts/backfill-embeddings.js
// Embeds all entries that don't yet have an embedding, 500ms apart to stay within Gemini rate limits.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var (find it in Supabase Dashboard → Settings → API)')
  process.exit(1)
}
if (!GEMINI_API_KEY) {
  console.error('Set GEMINI_API_KEY env var')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function embed(text) {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        output_dimensionality: 1536,
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.embedding.values
}

async function main() {
  // Fetch all entries without embeddings
  // Get already-embedded entry IDs
  const { data: existing } = await supabase.from('entry_embeddings').select('entry_id')
  const embeddedIds = new Set((existing || []).map(r => r.entry_id))

  const { data: entries, error } = await supabase
    .from('entries')
    .select('id, title, note, url')
    .is('deleted_at', null)

  const toEmbed = (entries || []).filter(e => !embeddedIds.has(e.id))

  if (error) { console.error('Failed to fetch entries:', error.message); process.exit(1) }
  console.log(`Found ${toEmbed.length} entries to embed (${embeddedIds.size} already done)`)

  let done = 0, failed = 0
  for (const entry of toEmbed) {
    const text = [entry.title, entry.note, entry.url].filter(Boolean).join(' ').slice(0, 2000)
    if (!text.trim()) { done++; continue }

    try {
      const embedding = await embed(text)
      const { error: upsertErr } = await supabase
        .from('entry_embeddings')
        .upsert({ entry_id: entry.id, embedding, embedded_at: new Date().toISOString() })
      if (upsertErr) throw new Error(upsertErr.message)
      done++
      process.stdout.write(`\r${done}/${toEmbed.length} embedded, ${failed} failed`)
    } catch (e) {
      failed++
      console.error(`\nFailed ${entry.id}: ${e.message}`)
    }

    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nDone. ${done} embedded, ${failed} failed.`)
}

main()
