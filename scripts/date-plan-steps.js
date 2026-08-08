#!/usr/bin/env node
// Run: SUPABASE_SERVICE_ROLE_KEY=... node scripts/date-plan-steps.js
//
// Adds `@YYYY-MM-DD` to plan steps that already NAME a month in their prose, so
// the Manager's agenda pane has something scheduled to show.
//
// The seeded plans said "**Aug 2026** — pre-semester" — readable, but the
// agenda is a query and prose is not queryable. This converts the month each
// step already claims into the machine-readable form src/lib/orgAgenda.js reads,
// without inventing a single date that was not already written down.
//
// The date used is the LAST day of the stated month, and that choice matters:
// "Aug 2026" is a month you have to finish something in, not a thing due on the
// 1st. Dating it to the 1st would make every step look late for 30 days.
//
// C++ Curriculum is deliberately left undated — its own doc says "~1 item per
// 1–2 weeks at a low simmer", which is a rhythm, not a schedule. Giving it
// dates would manufacture deadlines the plan explicitly does not have.
//
// Idempotent: a step that already ends in @date is skipped.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1) }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/**
 * The month a step claims, as an end-of-month date.
 * Handles "**Aug 2026** — …" and "*(Nov–Dec 2026)*" (takes the LAST month of a
 * range: that is when the work is due to be finished).
 */
function dateFor(line) {
  const range = /\*?\(?([A-Z][a-z]{2})[–\-—]([A-Z][a-z]{2})\s+(\d{4})\)?\*?/.exec(line)
  if (range) {
    const m = MONTHS[range[2].toLowerCase()]
    const y = Number(range[3])
    if (m) return `${y}-${String(m).padStart(2, '0')}-${lastDay(y, m)}`
  }
  const single = /\*?\*?\(?([A-Z][a-z]{2})\s+(\d{4})\)?\*?\*?/.exec(line)
  if (single) {
    const m = MONTHS[single[1].toLowerCase()]
    const y = Number(single[2])
    if (m) return `${y}-${String(m).padStart(2, '0')}-${lastDay(y, m)}`
  }
  return null
}

const TARGETS = ['Quant Dev Plan', 'Order Book (C++)']

async function main() {
  const { data: topics, error } = await supabase
    .from('topics').select('id, name, master_doc').in('name', TARGETS)
  if (error) throw new Error(error.message)

  for (const t of topics) {
    const lines = (t.master_doc || '').split('\n')
    let touched = 0

    const next = lines.map((line) => {
      if (!/^\s*[-*]\s+\[[ xX]\]/.test(line)) return line
      if (/@\d{4}-\d{2}-\d{2}\s*$/.test(line)) return line
      const date = dateFor(line)
      if (!date) return line
      touched++
      return `${line.trimEnd()} @${date}`
    })

    if (!touched) { console.log(`• ${t.name} — nothing to date.`); continue }

    const { error: upErr } = await supabase
      .from('topics').update({ master_doc: next.join('\n') }).eq('id', t.id)
    if (upErr) throw new Error(`${t.name}: ${upErr.message}`)
    console.log(`• ${t.name} — dated ${touched} steps.`)
  }
}

main().catch((e) => { console.error('\n' + e.message); process.exit(1) })
