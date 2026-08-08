#!/usr/bin/env node
// Run: SUPABASE_SERVICE_ROLE_KEY=... node scripts/make-library.js
//
// One "Library" topic; books become entries in it.
//
// Why this is the right shape for now: a book is not a subject, and it was
// never a topic — with one exception, "Little book of sephamores", which was
// the last surviving deep topic and is an empty shell. Everything else called
// a book in this app was already an entry, just scattered across the topic it
// happened to be read for.
//
// MOVING IS SAFE for the seeded plans: their master_doc names each book inline
// ("EMC++ Ch.4", "CCiA Ch.5"), so the plan still reads correctly with the entry
// filed elsewhere. The reference is in the prose, not in the foreign key.
//
// Idempotent and non-destructive: entries are MOVED (topic_id updated), never
// copied or deleted, and re-running finds them already in Library and stops.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
let USER_ID = process.env.CAPTURE_USER_ID || null

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Matched on exact title. A regex over titles pulled in "gmail crack py" and
// two YouTube videos about cracking software — close enough to look right in a
// list, wrong enough to move real data to the wrong place.
const BOOK_TITLES = [
  'Green book — A Practical Guide to Quantitative Finance Interviews (Xinfeng Zhou)',
  'Heard on the Street (Crack)',
  'ISL — An Introduction to Statistical Learning',
  'Effective Modern C++ (Scott Meyers)',
  'C++ Concurrency in Action (Williams)',
  'Effective STL (Meyers)',
  'Introduction to Statistical Learning (Python)',
  'Elements of Statistical Learning',
  'Beej’s Guide to Network Programming',
  'CSAPP — Computer Systems: A Programmer’s Perspective',
  'DDIA — Designing Data-Intensive Applications',
  'The Rust Book + Rustlings',
]

// The one book that became a topic, back when "deep topics" existed. It has no
// entries and no doc, so it converts to a single entry and the shell is
// archived rather than deleted — archiving is reversible.
const BOOK_TOPIC = 'Little book of sephamores'

const LIBRARY_DOC = `Books, one entry each.

A book is not a subject, so it does not get to be a topic — it gets read, noted
against, and finished. Reading notes belong on the entry; the subject topics
(Systems, Finance, C++ Curriculum…) still own the *thinking*, and their plans
name the books inline where it matters.

Status here means what it means everywhere else: \`active\` is in flight,
\`backlog\` is on deck, \`done\` is finished.
`

async function resolveUserId() {
  if (USER_ID) return USER_ID
  const { data, error } = await supabase.from('topics').select('user_id').limit(1)
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('No topics to infer user_id from; set CAPTURE_USER_ID.')
  return data[0].user_id
}

async function getOrCreateLibrary() {
  const { data: found } = await supabase
    .from('topics').select('id').eq('user_id', USER_ID).eq('name', 'Library').limit(1)
  if (found?.length) return { id: found[0].id, created: false }

  const { data, error } = await supabase
    .from('topics')
    .insert({ user_id: USER_ID, name: 'Library', icon: 'Book', master_doc: LIBRARY_DOC })
    .select('id').single()
  if (error) throw new Error(`Create Library: ${error.message}`)
  return { id: data.id, created: true }
}

async function main() {
  USER_ID = await resolveUserId()
  const { id: libraryId, created } = await getOrCreateLibrary()
  console.log(created ? '• Library — created.' : '• Library — already exists.')

  // 1. Move the book entries.
  const { data: entries, error } = await supabase
    .from('entries')
    .select('id, title, topic_id')
    .eq('user_id', USER_ID)
    .in('title', BOOK_TITLES)
    .is('deleted_at', null)
  if (error) throw new Error(`Read entries: ${error.message}`)

  const toMove = (entries ?? []).filter((e) => e.topic_id !== libraryId)
  if (toMove.length) {
    const { error: mvErr } = await supabase
      .from('entries')
      .update({ topic_id: libraryId })
      .in('id', toMove.map((e) => e.id))
    if (mvErr) throw new Error(`Move entries: ${mvErr.message}`)
  }
  console.log(`• Moved ${toMove.length} book${toMove.length === 1 ? '' : 's'} into Library.`)

  const missing = BOOK_TITLES.filter((t) => !(entries ?? []).some((e) => e.title === t))
  if (missing.length) console.log(`  (not found, skipped: ${missing.join(' · ')})`)

  // 2. The one book that was a topic.
  const { data: shell } = await supabase
    .from('topics').select('id, name').eq('user_id', USER_ID).eq('name', BOOK_TOPIC).is('archived_at', null).limit(1)

  if (shell?.length) {
    const { data: existing } = await supabase
      .from('entries').select('id').eq('user_id', USER_ID).eq('topic_id', libraryId)
      .eq('title', 'The Little Book of Semaphores').limit(1)

    if (!existing?.length) {
      const { error: insErr } = await supabase.from('entries').insert({
        user_id: USER_ID,
        topic_id: libraryId,
        title: 'The Little Book of Semaphores',
        url: 'https://greenteapress.com/wp/semaphores/',
        note: 'Was a "deep topic" until the reading UI was removed — it had no sections, no cursor and no notes, so nothing was lost in the conversion.',
        status: 'backlog',
      })
      if (insErr) throw new Error(`Create semaphores entry: ${insErr.message}`)
      console.log('• "Little book of sephamores" → an entry in Library.')
    }

    // Archived, not deleted: reversible, and it keeps the id alive in case
    // anything still points at it.
    const { error: arErr } = await supabase
      .from('topics').update({ archived_at: new Date().toISOString() }).eq('id', shell[0].id)
    if (arErr) throw new Error(`Archive shell topic: ${arErr.message}`)
    console.log('• Archived the empty book topic (reversible).')
  }

  const { count } = await supabase
    .from('entries').select('*', { count: 'exact', head: true })
    .eq('topic_id', libraryId).is('deleted_at', null)
  console.log(`\nLibrary now holds ${count} entries.`)
}

main().catch((e) => { console.error('\n' + e.message); process.exit(1) })
