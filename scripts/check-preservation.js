#!/usr/bin/env node
// Answers two questions the dashboard otherwise requires hand-written SQL for:
//
//   1. Is the Readability extractor actually working in production, or did the
//      Deno `npm:` imports silently fall back to the regex heuristic? That
//      failure mode logs nothing and throws nothing — extraction just gets worse
//      — so it needs an explicit check. See docs/tech-debt.md.
//   2. How much of the library is preserved overall?
//
//   node scripts/check-preservation.js            # coverage + recent captures
//   node scripts/check-preservation.js --recent 5 # widen the recent window
//
// Credentials come from .env.local automatically (it already holds
// SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL), so no setup is needed. Real
// environment variables win if set, which is what makes this usable in CI.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Minimal .env parser — enough for KEY=value lines, no dependency needed.
function readEnvFile(path = '.env.local') {
  try {
    const out = {}
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
    }
    return out
  } catch {
    return {}
  }
}

const fileEnv = readEnvFile()

function requireEnv(...names) {
  for (const n of names) {
    const v = process.env[n] ?? fileEnv[n]
    if (v) return v
  }
  console.error(`Missing ${names[0]}.`)
  console.error(`Add it to .env.local, or set it in the environment.`)
  process.exit(1)
}

const args = process.argv.slice(2)
const recentIdx = args.indexOf('--recent')
const recentCount = recentIdx >= 0 ? Number(args[recentIdx + 1]) || 5 : 5

const supabase = createClient(
  requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
)

const { data: rows, error } = await supabase
  .from('entries')
  .select('url, full_text_status, full_text_extractor, full_text_at, full_text')
  .not('url', 'is', null)
  .is('deleted_at', null)
if (error) {
  console.error('Query failed:', error.message)
  process.exit(1)
}

const count = (s) => rows.filter((r) => r.full_text_status === s).length
const total = rows.length
const preserved = count('ok')
const pct = total ? ((preserved / total) * 100).toFixed(1) : '0.0'

console.log(`\nCoverage — ${preserved}/${total} preserved (${pct}%)`)
console.log(`  ok            ${preserved}`)
console.log(`  empty         ${count('empty')}   (fetched, nothing extractable)`)
console.log(`  failed        ${count('failed')}`)
console.log(`  not attempted ${rows.filter((r) => !r.full_text_status).length}`)

// The verification that matters: which extractor produced the text.
const byExtractor = {}
for (const r of rows) {
  if (r.full_text_status !== 'ok') continue
  const k = r.full_text_extractor ?? '(unrecorded)'
  byExtractor[k] = (byExtractor[k] ?? 0) + 1
}
console.log('\nExtractor used (preserved rows only):')
for (const [k, v] of Object.entries(byExtractor).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(14)} ${v}`)
}

const recent = rows
  .filter((r) => r.full_text_at)
  .sort((a, b) => new Date(b.full_text_at) - new Date(a.full_text_at))
  .slice(0, recentCount)

console.log(`\n${recentCount} most recent capture attempts:`)
if (!recent.length) {
  console.log('  none yet — save an article in the app, then re-run this.')
} else {
  for (const r of recent) {
    const chars = r.full_text ? r.full_text.length : 0
    console.log(
      `  ${new Date(r.full_text_at).toISOString().slice(0, 16).replace('T', ' ')}` +
      `  ${(r.full_text_extractor ?? '—').padEnd(11)}` +
      `  ${String(r.full_text_status).padEnd(7)}` +
      `  ${String(chars).padStart(6)} chars  ${r.url.slice(0, 52)}`
    )
  }
}

// Verdict, based only on captures since the Readability deploy.
const since = new Date('2026-07-29T00:00:00Z').getTime()
const post = rows.filter((r) => r.full_text_at && new Date(r.full_text_at).getTime() >= since)
const readability = post.filter((r) => r.full_text_extractor === 'readability').length
const heuristic = post.filter((r) => r.full_text_extractor === 'heuristic').length

console.log('\nVerdict:')
if (!post.length) {
  console.log('  INCONCLUSIVE — no captures since the Readability deploy.')
  console.log('  Save any article in the app, wait a few seconds, re-run this.')
} else if (readability > 0) {
  console.log(`  WORKING — ${readability} capture(s) used Readability.`)
  console.log('  The Deno npm: imports resolve. Clear the ⚠️ item in docs/tech-debt.md.')
} else if (heuristic > 0) {
  console.log(`  FALLING BACK — ${heuristic} recent capture(s) used the heuristic,`)
  console.log('  0 used Readability. The npm: specifiers are not resolving in Deno.')
  console.log('  Check function logs: supabase functions logs enrich')
} else {
  console.log('  UNCLEAR — recent captures recorded no extractor.')
  console.log('  Likely captured before 0060 or by a path that skips preservationPatch.')
}
console.log()
