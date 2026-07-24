import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: t } = await sb.from('topics').select('id').eq('name', 'AI Chats').single()
const { data: ents } = await sb.from('entries').select('id,title,created_at').eq('topic_id', t.id).is('deleted_at', null)
const meta = Object.fromEntries(ents.map(e => [e.id, e]))
const ids = ents.map(e => e.id)

// pull embedded chunks in batches
let rows = []
for (let i = 0; i < ids.length; i += 40) {
  const { data } = await sb.from('content_chunks')
    .select('entry_id,content,embedding').in('entry_id', ids.slice(i, i + 40)).not('embedding', 'is', null)
  rows.push(...(data || []))
}

// summary by conversation
const byConv = {}
for (const r of rows) {
  const title = meta[r.entry_id].title.replace(/\s*\(part \d+\/\d+\)$/, '')
  byConv[title] = (byConv[title] || 0) + 1
}
const convs = Object.entries(byConv).sort((a, b) => b[1] - a[1])
console.log(`embedded chunks: ${rows.length} across ${convs.length} conversations\n`)
for (const [ti, n] of convs) console.log(`  ${String(n).padStart(3)}  ${ti}`)

// write full vector export (parse pgvector string → floats, round to 5dp to shrink)
const out = rows.map(r => {
  const vec = (typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding).map(x => +x.toFixed(5))
  return { t: meta[r.entry_id].title.replace(/\s*\(part \d+\/\d+\)$/, ''), c: r.content, v: vec }
})
writeFileSync(process.argv[2] || 'demo-data.json', JSON.stringify(out))
console.log(`\nwrote ${out.length} chunk vectors → ${process.argv[2]}`)
