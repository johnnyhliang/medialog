// Build the demo data file: {convs:{title:fullText}, chunks:[{t,c,v}]}.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const OUT = process.argv[2]

const base = t => t.replace(/\s*\(part \d+\/\d+\)$/, '')
const BLOCK = ['performance alter ego','offer rescinded','warm rejection','rent discrepancy',
  'rena labs','worship','glow-up','frizzy oily','phone number','i need help finding',
  'things that there are 7','```','{"white"','💬','feeling unheard','landlord']
const blocked = t => BLOCK.some(b => base(t).toLowerCase().includes(b))

const NOISE = [/This block is not supported[^.]*\.?/g, /I'?m searching the conversation history[^.]*\./g,
  /Let me check my notes[^.]*\./g, /```[\s\S]*?```/g]
function snippet(s){
  let x = s.replace(/^#+.*$/gm,'').replace(/_[^_]*·[^_]*_/g,'')
  x = x.split(/\*\*Asked:\*\*/).map(seg=>seg.replace(/^[^\n]*\n/,'')).join(' ')
  for(const re of NOISE) x = x.replace(re,' ')
  return x.replace(/[*`#>]/g,'').replace(/\s+/g,' ').trim()
}
function fullText(md){
  let x = md.replace(/^# .*$/m,'').replace(/^_.*·.*_$/m,'').replace(/^##\s*.*$/gm,'')
    .replace(/\*\*Asked:\*\*/g,'Q: ')
  for(const re of NOISE) x = x.replace(re,'')
  return x.replace(/[*`#>]/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,12000)
}

const { data: t } = await sb.from('topics').select('id').eq('name','AI Chats').single()
const { data: ents } = await sb.from('entries').select('id,title,note,created_at')
  .eq('topic_id', t.id).is('deleted_at', null)
const meta = Object.fromEntries(ents.map(e => [e.id, e]))
const ids = ents.map(e => e.id)

const convs = {}
for (const e of ents.sort((a,b)=>a.title.localeCompare(b.title))) {
  const bt = base(e.title); if (blocked(bt) || !e.note) continue
  convs[bt] = (convs[bt] ? convs[bt] + '\n\n' : '') + fullText(e.note)
}

let rows = []
for (let i=0;i<ids.length;i+=40){
  const { data } = await sb.from('content_chunks').select('entry_id,content,embedding')
    .in('entry_id', ids.slice(i,i+40)).not('embedding','is',null)
  rows.push(...(data||[]))
}
const perConv = {}
const chunks = []
for (const r of rows) {
  const bt = base(meta[r.entry_id].title); if (blocked(bt)) continue
  const c = snippet(r.content); if (c.length < 90) continue
  perConv[bt] = (perConv[bt]||0); if (perConv[bt] >= 4) continue; perConv[bt]++
  const v = (typeof r.embedding==='string'?JSON.parse(r.embedding):r.embedding).map(x=>+x.toFixed(5))
  chunks.push({ t: bt, c: c.slice(0,360), v })
}
const used = new Set(chunks.map(c=>c.t))
for (const k of Object.keys(convs)) if (!used.has(k)) delete convs[k]

writeFileSync(OUT, JSON.stringify({ convs, chunks }))
console.log(`chunks: ${chunks.length} · conversations: ${used.size} · full-texts: ${Object.keys(convs).length}`)
console.log(`size: ${(JSON.stringify({convs,chunks}).length/1024/1024).toFixed(2)} MB`)
console.log('poker present:', [...used].some(t=>/poker/i.test(t)))
