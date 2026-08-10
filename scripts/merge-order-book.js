#!/usr/bin/env node
// Run: SUPABASE_SERVICE_ROLE_KEY=... node scripts/merge-order-book.js
//
// Merges "Order Book Implementation" (2026-07-09, hand-made) into
// "Order Book (C++)" (2026-08-08, seeded from quantdevplan.xlsx).
//
// The duplicate is mine: the seed script created a second order-book topic
// without checking whether one already existed. The older topic is the one with
// the better prose — a real description of what the project IS, which the
// seeded doc never had because the spreadsheet's Project sheet only listed
// phases. So this keeps BOTH halves rather than picking a winner: the older
// description becomes the project's opening paragraph, above the phases.
//
// Entries are MOVED, never copied. The shell is soft-deleted, so it sits in
// Trash and is restorable — nothing here is irreversible.
//
// Idempotent: if the older topic is already gone, it reports and exits.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1) }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const FROM = 'Order Book Implementation'
const INTO = 'Order Book (C++)'

async function main() {
  const { data: topics, error } = await supabase
    .from('topics').select('id, name, master_doc').in('name', [FROM, INTO]).is('deleted_at', null)
  if (error) throw new Error(error.message)

  const from = topics.find((t) => t.name === FROM)
  const into = topics.find((t) => t.name === INTO)

  if (!into) throw new Error(`"${INTO}" not found — nothing to merge into.`)
  if (!from) { console.log(`• "${FROM}" is already gone. Nothing to do.`); return }

  // 1. Fold the older description in, above the phases but below frontmatter,
  //    so goals.js still parses the dates and the steps.
  const desc = (from.master_doc || '').trim()
  const doc = into.master_doc || ''
  if (desc && !doc.includes(desc)) {
    const m = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/.exec(doc)
    const merged = m ? `${m[1]}\n${desc}\n${m[2].replace(/^\n+/, '')}` : `${desc}\n\n${doc}`
    const { error: docErr } = await supabase
      .from('topics').update({ master_doc: merged }).eq('id', into.id)
    if (docErr) throw new Error(`Merge doc: ${docErr.message}`)
    console.log('• Folded the older description into the project doc.')
  } else {
    console.log('• Description already present, left alone.')
  }

  // 2. Move the entries.
  const { data: moved, error: mvErr } = await supabase
    .from('entries').update({ topic_id: into.id }).eq('topic_id', from.id).select('id')
  if (mvErr) throw new Error(`Move entries: ${mvErr.message}`)
  console.log(`• Moved ${moved?.length ?? 0} entries.`)

  // 3. Anything else pointing at the old topic. topic_state is the only other
  //    table keyed by topic_id that holds authored text.
  const { data: state } = await supabase
    .from('topic_state').select('topic_id, next_action, parked_note').eq('topic_id', from.id).maybeSingle()
  if (state?.next_action || state?.parked_note) {
    console.log(`  ⚠ the old topic had state worth reading: ${JSON.stringify(state)}`)
  }

  // 4. Retire the shell — soft delete, restorable from Trash.
  const { error: delErr } = await supabase
    .from('topics').update({ deleted_at: new Date().toISOString() }).eq('id', from.id)
  if (delErr) throw new Error(`Retire shell: ${delErr.message}`)
  console.log(`• Soft-deleted "${FROM}" (restorable from Trash).`)
}

main().catch((e) => { console.error('\n' + e.message); process.exit(1) })
