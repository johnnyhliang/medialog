#!/usr/bin/env node
// Backfill preserved article text (`entries.full_text`) for URL entries captured
// before the Readability extractor existed, and mark preservation coverage.
//
//   node scripts/backfill-full-text.js                 # everything not yet attempted
//   node scripts/backfill-full-text.js --retry         # also retry empty/failed entries
//   node scripts/backfill-full-text.js --rps=1         # slow down (default 2/sec)
//   node scripts/backfill-full-text.js --limit=200     # stop after N entries
//   node scripts/backfill-full-text.js --no-reindex    # skip re-embedding
//   node scripts/backfill-full-text.js --dry-run       # fetch + extract, write nothing
//   node scripts/backfill-full-text.js --coverage      # print coverage and exit
//
// RESUMABLE: every processed entry gets a `full_text_status`, and the work queue
// is "status is null", so an interrupted run simply picks up where it stopped.
//
// RATE LIMITED, and that matters: better extraction produces different text,
// which changes the FNV-1a source_hash in content_chunks, which means every
// backfilled entry RE-EMBEDS. Draining a large library at full speed would fire
// thousands of embedding calls against one shared key. --rps bounds the whole
// loop (fetch + extract + re-embed), so it bounds the embedding burst too.

import { createClient } from '@supabase/supabase-js'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { extractArticle, makeReadabilityParser } from '../supabase/functions/_shared/extractArticle.ts'
import { processEntry, hasEmbeddingKeys } from './rechunk.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const flag = (name) => process.argv.includes(`--${name}`)

const RPS = Number(arg('rps', process.env.BACKFILL_RPS ?? 2))
const LIMIT = Number(arg('limit', Infinity))
const RETRY = flag('retry')
const DRY_RUN = flag('dry-run')
const REINDEX = !flag('no-reindex')
const COVERAGE_ONLY = flag('coverage')

const FETCH_TIMEOUT_MS = 15000
const MAX_BYTES = 2 * 1024 * 1024 // generous vs. the edge function's 512KB — no CPU/memory cap here
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

for (const [k, v] of Object.entries({ VITE_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })) {
  if (!v) { console.error(`Set ${k}`); process.exit(1) }
}
if (!Number.isFinite(RPS) || RPS <= 0) { console.error('--rps must be a positive number'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const parse = makeReadabilityParser({ Readability, parseHTML })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The same statuses the client writes (src/lib/preservation.js).
const OK = 'ok', EMPTY = 'empty', FAILED = 'failed'

async function reportCoverage() {
  const counts = {}
  for (const status of [OK, EMPTY, FAILED]) {
    const { count } = await supabase.from('entries')
      .select('id', { count: 'exact', head: true })
      .not('url', 'is', null).is('deleted_at', null).eq('full_text_status', status)
    counts[status] = count ?? 0
  }
  const { count: notAttempted } = await supabase.from('entries')
    .select('id', { count: 'exact', head: true })
    .not('url', 'is', null).is('deleted_at', null).is('full_text_status', null)
  const total = counts[OK] + counts[EMPTY] + counts[FAILED] + (notAttempted ?? 0)
  const pct = total ? ((counts[OK] / total) * 100).toFixed(1) : '0.0'
  console.log(
    `Coverage: ${counts[OK]}/${total} url entries preserved (${pct}%) — ` +
    `${counts[EMPTY]} unextractable, ${counts[FAILED]} failed, ${notAttempted ?? 0} not attempted`
  )
}

// PostgREST caps a select at 1000 rows, so page through rather than silently
// truncating. Oldest-first: the oldest entries are the ones most at risk of the
// source page having already died.
async function fetchQueue() {
  const page = 1000
  const all = []
  for (let from = 0; all.length < LIMIT; from += page) {
    let q = supabase.from('entries')
      .select('id, user_id, url, note, full_text, takeaway, full_text_status')
      .not('url', 'is', null).is('deleted_at', null)
      .order('created_at', { ascending: true })
      .range(from, from + page - 1)
    // Resumability lives here: untouched entries have a null status, so a re-run
    // never re-fetches what already succeeded.
    q = RETRY ? q.or(`full_text_status.is.null,full_text_status.in.(${EMPTY},${FAILED})`) : q.is('full_text_status', null)
    const { data, error } = await q
    if (error) { console.error('Fetch failed:', error.message); process.exit(1) }
    all.push(...data)
    if (data.length < page) break
  }
  return all.slice(0, LIMIT === Infinity ? undefined : LIMIT)
}

async function fetchHtml(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!res.ok) return { html: null, reason: `http ${res.status}` }
    const type = res.headers.get('content-type') ?? ''
    // PDFs, images and video are (b)/(c) territory in the preservation plan.
    if (type && !/html|xml|text\/plain/i.test(type)) return { html: null, reason: `content-type ${type.split(';')[0]}` }
    const buf = new Uint8Array(await res.arrayBuffer())
    return { html: new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, MAX_BYTES)), reason: null }
  } catch (e) {
    return { html: null, reason: e.name === 'AbortError' ? 'timeout' : (e.message ?? 'fetch error') }
  } finally {
    clearTimeout(timer)
  }
}

const canReindex = REINDEX && !DRY_RUN && hasEmbeddingKeys()

async function backfillOne(entry) {
  const { html, reason } = await fetchHtml(entry.url)
  const at = new Date().toISOString()

  if (!html) {
    if (!DRY_RUN) {
      await supabase.from('entries')
        .update({ full_text_status: FAILED, full_text_extractor: null, full_text_at: at })
        .eq('id', entry.id)
    }
    return { status: FAILED, reason, reindexed: false }
  }

  const article = extractArticle(html, entry.url, { parse })
  if (!article.full_text) {
    if (!DRY_RUN) {
      await supabase.from('entries')
        .update({ full_text_status: EMPTY, full_text_extractor: null, full_text_at: at })
        .eq('id', entry.id)
    }
    return { status: EMPTY, reason: 'no article body', reindexed: false }
  }

  if (DRY_RUN) return { status: OK, chars: article.full_text.length, reindexed: false }

  const { error } = await supabase.from('entries').update({
    full_text: article.full_text,
    full_text_status: OK,
    full_text_extractor: article.extractor,
    full_text_at: at,
  }).eq('id', entry.id)
  if (error) throw new Error(error.message)

  // Re-chunk inside the rate-limited loop so the embedding burst is throttled
  // too. processEntry is a no-op when the text's hash is unchanged.
  let reindexed = false
  if (REINDEX && canReindex) {
    try {
      await processEntry({ ...entry, full_text: article.full_text })
      reindexed = true
    } catch (e) {
      // Chunks are derived data — scripts/rechunk.js can always rebuild them
      // later. Losing an embedding must not lose the preserved text.
      console.error(`\n  reindex failed for ${entry.id}: ${e.message}`)
    }
  }
  return { status: OK, chars: article.full_text.length, extractor: article.extractor, reindexed }
}

async function main() {
  if (COVERAGE_ONLY) { await reportCoverage(); return }

  await reportCoverage()
  if (REINDEX && !DRY_RUN && !canReindex) {
    console.warn('No Gemini key — preserving text WITHOUT re-embedding. Run scripts/rechunk.js afterwards.')
  }

  const queue = await fetchQueue()
  console.log(
    `${queue.length} entries to backfill (rps=${RPS}${RETRY ? ', retrying empty/failed' : ''}` +
    `${DRY_RUN ? ', DRY RUN' : ''}${canReindex ? ', reindexing' : ''})`
  )
  if (!queue.length) return

  const minInterval = 1000 / RPS
  const tally = { [OK]: 0, [EMPTY]: 0, [FAILED]: 0 }
  let errors = 0, reindexed = 0
  const started = Date.now()

  for (const [i, entry] of queue.entries()) {
    const tick = Date.now()
    try {
      const r = await backfillOne(entry)
      tally[r.status]++
      if (r.reindexed) reindexed++
    } catch (e) {
      errors++
      console.error(`\nFailed ${entry.id} (${entry.url}): ${e.message}`)
    }
    const elapsed = (Date.now() - started) / 1000
    process.stdout.write(
      `\r${i + 1}/${queue.length}  ok=${tally[OK]} empty=${tally[EMPTY]} failed=${tally[FAILED]}` +
      ` reindexed=${reindexed} err=${errors}  ${(( i + 1) / Math.max(elapsed, 1)).toFixed(2)}/s   `
    )
    // Throttle on the wall clock rather than a flat sleep, so a slow fetch that
    // already ate the interval does not pay for it twice.
    const spent = Date.now() - tick
    if (spent < minInterval) await sleep(minInterval - spent)
  }

  console.log(`\nDone. preserved=${tally[OK]} unextractable=${tally[EMPTY]} failed=${tally[FAILED]} errors=${errors}`)
  if (!DRY_RUN) await reportCoverage()
}

main()
