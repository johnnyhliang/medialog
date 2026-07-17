import { searchChunks } from './db/retrieval.js'

// Comparative harness: run before and after a chunkConfig change. failureRate is
// the metric Anthropic's contextual-retrieval numbers use (share of queries
// where NO expected result appears in the top-k), so results are comparable.
export function scoreRun(results) {
  if (!results.length) return { failureRate: 0, recallAt5: 0, mrr: 0, perQuery: [] }

  const perQuery = results.map((r) => {
    const expected = new Set(r.expected ?? [])
    const rank = r.retrieved.findIndex((id) => expected.has(id))
    const hitInTop5 = r.retrieved.slice(0, 5).some((id) => expected.has(id))
    return {
      query: r.query,
      failed: expected.size > 0 && rank === -1,
      recallAt5: hitInTop5 ? 1 : 0,
      reciprocalRank: rank === -1 ? 0 : 1 / (rank + 1),
    }
  })

  const n = perQuery.length
  return {
    failureRate: perQuery.filter((p) => p.failed).length / n,
    recallAt5: perQuery.reduce((s, p) => s + p.recallAt5, 0) / n,
    mrr: perQuery.reduce((s, p) => s + p.reciprocalRank, 0) / n,
    perQuery,
  }
}

export async function runEval(supabase, fixture) {
  const results = []
  for (const q of fixture.queries) {
    const hits = await searchChunks(supabase, { query: q.query, topK: 20 })
    results.push({ query: q.query, retrieved: hits.map((h) => h.entryId), expected: q.expected })
  }
  return scoreRun(results)
}
