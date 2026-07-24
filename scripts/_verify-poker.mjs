import { readFileSync } from 'node:fs'
const D = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const DATA = D.chunks
for (const it of DATA) { let n = 0; for (const x of it.v) n += x * x; it._n = Math.sqrt(n) || 1 }

async function emb(text) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=' + process.env.GEMINI_API_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] }, output_dimensionality: 1536, taskType: 'RETRIEVAL_QUERY' }),
  })
  if (!r.ok) throw new Error(r.status)
  return (await r.json()).embedding.values
}
function topK(qv, k) {
  let qn = 0; for (const x of qv) qn += x * x; qn = Math.sqrt(qn) || 1
  const s = DATA.map(d => { let dot = 0; for (let j = 0; j < d.v.length; j++) dot += d.v[j] * qv[j]; return { d, s: dot / (qn * d._n) } })
  s.sort((a, b) => b.s - a.s)
  const seen = new Set(), out = []
  for (const x of s) { if (seen.has(x.d.t)) continue; seen.add(x.d.t); out.push(x); if (out.length >= k) break }
  return out
}
const q = process.argv[3]
const qv = await emb(q)
console.log(`"${q}"  (has full-text for top hit? see FULL flag)\n`)
for (const h of topK(qv, 4)) console.log(`  [${h.s.toFixed(3)}] FULL=${!!D.convs[h.d.t]} ${h.d.t.slice(0,42).padEnd(42)} | ${h.d.c.slice(0,80)}`)
