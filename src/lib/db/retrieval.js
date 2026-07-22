import {
  MATCH_COUNT, RRF_K, TRIGRAM_THRESHOLD, TRIGRAM_MAX_QUERY_WORDS, TASK_TYPE_QUERY,
} from '../chunkConfig.js'

// Trigram rescues short misspelled lookups but is noisy on prose.
export function shouldUseTrigram(query) {
  const words = String(query ?? '').trim().split(/\s+/).filter(Boolean)
  return words.length > 0 && words.length <= TRIGRAM_MAX_QUERY_WORDS
}

// Maximal Marginal Relevance. Pure cosine surfaces near-duplicates — five hits
// restating one idea — which defeats connecting ACROSS subjects. Diversity here
// is by topic, the dimension we actually want spread over.
export function mmrSelect(candidates, { k = 5, lambda = 0.5 } = {}) {
  const pool = [...candidates]
  const picked = []
  while (pool.length && picked.length < k) {
    let bestIdx = 0
    let bestVal = -Infinity
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i]
      const redundancy = picked.some((p) => p.topicId && p.topicId === c.topicId) ? 1 : 0
      const val = lambda * c.score - (1 - lambda) * redundancy
      if (val > bestVal) { bestVal = val; bestIdx = i }
    }
    picked.push(pool.splice(bestIdx, 1)[0])
  }
  return picked
}

async function embedQuery(supabase, query) {
  const { data, error } = await supabase.functions.invoke('embed-entry', {
    body: { text: query, taskType: TASK_TYPE_QUERY },
  })
  if (error || !data?.embedding) return null
  return data.embedding
}

async function hydrate(supabase, hits) {
  if (!hits.length) return []
  const ids = hits.map((h) => h.chunk_id)
  const { data } = await supabase
    .from('content_chunks')
    .select('id, entry_id, content, heading, anchor, char_start')
    .in('id', ids)
  const byId = new Map((data ?? []).map((r) => [r.id, r]))
  return hits
    .map((h) => {
      const row = byId.get(h.chunk_id)
      if (!row) return null
      return {
        chunkId: row.id,
        entryId: row.entry_id,
        score: h.score,
        content: row.content,      // never surface `context` — it's machine-written
        heading: row.heading,
        anchor: row.anchor,
        charStart: row.char_start,
      }
    })
    .filter(Boolean)
}

// Stateless and repeatably callable: the UI calls it once, the future agent
// calls it in a loop with refined queries. Do not add hidden state here.
export async function searchChunks(supabase, { query, topK = MATCH_COUNT, useTrigram } = {}) {
  const q = String(query ?? '').trim()
  if (!q) return []
  const embedding = await embedQuery(supabase, q)
  if (!embedding) return []
  const { data, error } = await supabase.rpc('search_chunks', {
    query_embedding: embedding,
    query_text: q,
    match_count: topK,
    rrf_k: RRF_K,
    trgm_threshold: TRIGRAM_THRESHOLD,
    use_trigram: useTrigram ?? shouldUseTrigram(q),
  })
  if (error) throw new Error(error.message)
  return hydrate(supabase, data ?? [])
}

// Uses the entry's OWN stored vectors as the query — no new embedding call.
export async function relatedTo(supabase, { entryId, topK = 5 } = {}) {
  const { data: mine } = await supabase
    .from('content_chunks')
    .select('embedding')
    .eq('entry_id', entryId)
    .limit(1)
  const embedding = mine?.[0]?.embedding
  if (!embedding) return []

  const { data, error } = await supabase.rpc('search_chunks', {
    query_embedding: embedding,
    query_text: '',
    match_count: 50,
    rrf_k: RRF_K,
    trgm_threshold: TRIGRAM_THRESHOLD,
    use_trigram: false,
  })
  if (error) throw new Error(error.message)

  const hits = (data ?? []).filter((h) => h.entry_id !== entryId)
  const hydrated = await hydrate(supabase, hits)

  // Roll up to one best chunk per entry, then diversify by topic.
  const bestByEntry = new Map()
  for (const h of hydrated) {
    const prev = bestByEntry.get(h.entryId)
    if (!prev || h.score > prev.score) bestByEntry.set(h.entryId, h)
  }
  const rolled = [...bestByEntry.values()]

  const { data: entries } = await supabase
    .from('entries')
    .select('id, topic_id')
    .in('id', rolled.map((r) => r.entryId))
  const topicByEntry = new Map((entries ?? []).map((e) => [e.id, e.topic_id]))

  return mmrSelect(
    rolled.map((r) => ({ ...r, id: r.chunkId, topicId: topicByEntry.get(r.entryId) ?? null })),
    { k: topK, lambda: 0.5 }
  )
}

// Collapse passage hits to one row per entry, keeping the highest-ranked
// passage (the input is already rank-ordered by search_chunks).
export function bestPerEntry(hits) {
  const seen = new Map()
  for (const h of hits) {
    if (!seen.has(h.entryId)) seen.set(h.entryId, h)
  }
  return [...seen.values()]
}

// Entry-shaped results for the existing search UI, each carrying the passage
// that actually matched. `similarity` is deliberately null: search_chunks
// returns an RRF score (~0.01-0.05), which is a RANK artifact, not a 0-1
// similarity — rendering it as a percentage would be meaningless.
export async function searchChunksAsEntries(supabase, query, { topK = MATCH_COUNT } = {}) {
  const hits = await searchChunks(supabase, { query, topK })
  const best = bestPerEntry(hits)
  if (!best.length) return []

  const { data, error } = await supabase
    .from('entries')
    .select('*, entry_tags(tags(name)), topics(name)')
    .in('id', best.map((h) => h.entryId))
    .is('deleted_at', null)
  if (error) throw new Error(error.message)

  const byId = new Map((data ?? []).map((e) => [e.id, e]))
  return best
    .map((h) => {
      const e = byId.get(h.entryId)
      if (!e) return null
      const tags = (e.entry_tags || []).map((et) => et.tags?.name).filter(Boolean)
      const { entry_tags, topics, ...rest } = e
      return {
        ...rest,
        tags,
        topicName: topics?.name ?? '',
        similarity: null,
        passage: h.content,
        passageHeading: h.heading,
        passageAnchor: h.anchor,
      }
    })
    .filter(Boolean) // rank order preserved; do NOT re-sort by score
}
