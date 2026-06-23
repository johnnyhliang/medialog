#!/usr/bin/env node
// Run: SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-study-setup.js
//
// Sets up a self-study structure that keeps the three jobs distinct:
//   • Systems  (study)  — one resource in flight, lab-first, takeaways logged
//   • Projects (build)  — references + work, each can have its own active thing
//   • Hobbies  (parking) — park interesting-but-distracting stuff, then get back to work
//
// Idempotent: topics that already exist are reused and their entries are left
// alone, so re-running won't duplicate. Safe to delete any of this by hand later.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
let USER_ID = process.env.CAPTURE_USER_ID || null

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var (Supabase Dashboard → Settings → API → service_role).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SYSTEMS_DOC = `## Active: CSAPP — lab-first
Next: Cache Lab — implement the LRU sim

Read only what the lab forces. The lab is the resource; the chapters are reference.
One resource in flight at a time — everything else stays Backlog.

Labs, in order: Data → Bomb/Attack → Cache → Shell → Malloc → Proxy
`

const PROJECTS_DOC = `## What I'm building
Each project can have its own \`active\` thing — but ship, don't collect.
Learn-in-public: turn each CSAPP lab takeaway into one short post here.
`

const HOBBIES_DOC = `## Parking lot
When something interesting-but-distracting ambushes a study session, park it here
and keep working. This is a defense, not a backlog to feel guilty about. Time-box it.
`

// name → { icon (Lucide name from TopicsGrid's ICON_MAP), master_doc, entries[] }
const PLAN = [
  {
    name: 'Systems',
    icon: 'Cpu',
    master_doc: SYSTEMS_DOC,
    entries: [
      {
        title: 'CSAPP — Computer Systems: A Programmer’s Perspective',
        url: 'https://csapp.cs.cmu.edu/',
        note: 'Spine resource. Lab-first: do the lab, read only what it forces.',
        status: 'active',
        pinned: true,
      },
      {
        title: 'Data Lab — bit puzzles',
        note: 'Done. Takeaway: two’s complement + masking; isolate the sign with (x >> 31) & 1.',
        status: 'done',
      },
      { title: 'DDIA — Designing Data-Intensive Applications', url: 'https://dataintensive.net/', note: 'Backlog. System-design spine — after CSAPP.', status: 'backlog' },
      { title: 'The Rust Book + Rustlings', url: 'https://doc.rust-lang.org/book/', note: 'Backlog. The language to reimplement labs in once fundamentals land.', status: 'backlog' },
      { title: 'Beej’s Guide to Network Programming', url: 'https://beej.us/guide/bgnet/', note: 'Backlog. Pulls in once CSAPP’s networking chapter whets it.', status: 'backlog' },
    ],
  },
  {
    name: 'Projects',
    icon: 'Code',
    master_doc: PROJECTS_DOC,
    entries: [
      { title: 'Learn-in-public blog', note: 'One short post per CSAPP lab. The output that forces real understanding + builds presence.', status: 'active', pinned: true },
      { title: 'Bot project (ideas)', note: 'Fun build to stay awake. Let it pull in the system-design reading it needs.', status: 'backlog' },
    ],
  },
  {
    name: 'Hobbies',
    icon: 'Gamepad2',
    master_doc: HOBBIES_DOC,
    entries: [
      { title: 'Interesting guitar video (parked)', note: 'Example: park-don’t-chase. Capture it here mid-session, get back to work.', status: 'backlog' },
    ],
  },
]

async function resolveUserId() {
  if (USER_ID) return USER_ID
  const { data, error } = await supabase.from('topics').select('user_id').limit(1)
  if (error) throw new Error(`Could not read topics: ${error.message}`)
  if (!data || !data.length) {
    throw new Error('No existing topics to infer your user_id from. Set CAPTURE_USER_ID (your Supabase auth user UUID).')
  }
  return data[0].user_id
}

async function getOrCreateTopic({ name, icon, master_doc }) {
  const { data: existing } = await supabase
    .from('topics').select('id').eq('user_id', USER_ID).eq('name', name).limit(1)
  if (existing && existing.length) return { id: existing[0].id, created: false }

  const { data, error } = await supabase
    .from('topics')
    .insert({ user_id: USER_ID, name, icon, master_doc })
    .select('id')
    .single()
  if (error) throw new Error(`Create topic "${name}": ${error.message}`)
  return { id: data.id, created: true }
}

async function main() {
  USER_ID = await resolveUserId()
  console.log(`Seeding study setup for user ${USER_ID}\n`)

  for (const topic of PLAN) {
    const { id, created } = await getOrCreateTopic(topic)
    if (!created) {
      console.log(`• ${topic.name} — already exists, leaving its entries untouched.`)
      continue
    }
    const rows = topic.entries.map((e) => ({
      user_id: USER_ID,
      topic_id: id,
      title: e.title,
      url: e.url ?? null,
      note: e.note ?? '',
      status: e.status,
      pinned: e.pinned ?? false,
    }))
    const { error } = await supabase.from('entries').insert(rows)
    if (error) throw new Error(`Seed entries for "${topic.name}": ${error.message}`)
    console.log(`• ${topic.name} — created with ${rows.length} entries.`)
  }

  console.log('\nDone. Open the app: the Systems → CSAPP card should greet you in the Focus widget.')
}

main().catch((e) => { console.error('\n' + e.message); process.exit(1) })
