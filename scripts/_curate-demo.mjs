import { readFileSync, writeFileSync } from 'node:fs'
const src = JSON.parse(readFileSync(process.argv[2], 'utf8'))

// exclude sensitive/personal + junk conversations from a public demo
const BLOCK = [
  'performance alter ego', 'offer rescinded', 'warm rejection', 'rent discrepancy',
  'rena labs', 'worship', 'glow-up', 'frizzy oily', 'phone number',
  'i need help finding', 'things that there are 7', '```', '{"white"', '💬',
]
const blocked = t => BLOCK.some(b => t.toLowerCase().includes(b))

// clean passage text for display: strip headings, Asked-questions, code, artifact leaks
const NOISE = [/This block is not supported[^.]*\.?/g, /I'?m searching the conversation history[^.]*\./g, /Let me check my notes[^.]*\./g, /```[\s\S]*?```/g]
function clean(s) {
  let x = s.replace(/^#+.*$/gm, '').replace(/_[^_]*·[^_]*_/g, '')
  x = x.split(/\*\*Asked:\*\*/).map(seg => seg.replace(/^[^\n]*\n/, '')).join(' ')
  for (const re of NOISE) x = x.replace(re, ' ')
  return x.replace(/[*`#>]/g, '').replace(/\s+/g, ' ').trim()
}

const perConv = {}
const out = []
for (const r of src) {
  if (blocked(r.t)) continue
  const text = clean(r.c)
  if (text.length < 90) continue
  perConv[r.t] = (perConv[r.t] || 0)
  if (perConv[r.t] >= 4) continue      // diversity: cap chunks per conversation
  perConv[r.t]++
  out.push({ t: r.t, c: text.slice(0, 360), v: r.v })
}
writeFileSync(process.argv[3], JSON.stringify(out))
const titles = [...new Set(out.map(o => o.t))]
console.log(`kept ${out.length} chunks across ${titles.length} conversations`)
console.log(`size: ${(JSON.stringify(out).length / 1024 / 1024).toFixed(2)} MB`)
console.log('\nincluded:')
for (const ti of titles) console.log('  ·', ti)
