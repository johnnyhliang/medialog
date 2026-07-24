import { readFileSync } from 'node:fs'
const DATA = JSON.parse(readFileSync(process.argv[2], 'utf8'))
for (const it of DATA) { let n = 0; for (const x of it.v) n += x * x; it._n = Math.sqrt(n) || 1 }

async function embedQuery(text) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=' + process.env.GEMINI_API_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] }, output_dimensionality: 1536, taskType: 'RETRIEVAL_QUERY' }),
  })
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 80))
  return (await r.json()).embedding.values
}
function topK(qv, k) {
  let qn = 0; for (const x of qv) qn += x * x; qn = Math.sqrt(qn) || 1
  const scored = DATA.map(d => { let dot = 0; const v = d.v; for (let j = 0; j < v.length; j++) dot += v[j] * qv[j]; return { d, s: dot / (qn * d._n) } })
  scored.sort((a, b) => b.s - a.s)
  const seen = new Set(), out = []
  for (const x of scored) { if (seen.has(x.d.t)) continue; seen.add(x.d.t); out.push(x); if (out.length >= k) break }
  return out
}

for (const q of process.argv.slice(3)) {
  const qv = await embedQuery(q)
  console.log(`\n### "${q}"`)
  for (const h of topK(qv, 4)) console.log(`  [${h.s.toFixed(3)}] ${h.d.t.slice(0, 40).padEnd(40)} | ${h.d.c.slice(0, 90)}`)
  await new Promise(z => setTimeout(z, 1500))
}
