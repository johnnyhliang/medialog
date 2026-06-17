// Subsequence fuzzy match with prefix + contiguity scoring.
function scoreString(query, target) {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (!q) return 0
  if (t.startsWith(q)) return 1000 - t.length // strong prefix bonus
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak += 1
      score += 1 + streak // contiguous chars score more
      qi += 1
    } else {
      streak = 0
    }
  }
  if (qi < q.length) return -1 // not all query chars matched
  return score
}

export function fuzzyFind(query, items, keys) {
  if (!query || !query.trim()) return items
  const scored = []
  for (const item of items) {
    let best = -1
    for (const key of keys) {
      const val = item[key]
      if (typeof val !== 'string') continue
      const s = scoreString(query.trim(), val)
      if (s > best) best = s
    }
    if (best >= 0) scored.push({ item, score: best })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.item)
}
