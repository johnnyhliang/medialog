import {
  MATCH_COUNT, RRF_K, TRIGRAM_THRESHOLD, TRIGRAM_MAX_QUERY_WORDS, TASK_TYPE_QUERY,
} from '../chunkConfig.js'
import { unwrap, unwrapList } from './unwrap.js'

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
  // A failed embed call used to return null, which searchChunks turned into an
  // empty result set — so an outage of the embedding function was indistinguish-
  // able from "your library has nothing on this". That is the exact lie this
  // sweep exists to remove, so a genuine error now throws. A *successful* call
  // that returns no embedding still yields null: that is a well-formed "cannot
  // embed this query", not a failure.
  const data = unwrap(
    await supabase.functions.invoke('embed-entry', {
      body: { text: query, taskType: TASK_TYPE_QUERY },
    }),
    'embedQuery'
  )
  return data?.embedding ?? null
}

async function hydrate(supabase, hits) {
  if (!hits.length) return []
  const ids = hits.map((h) => h.chunk_id)
  // Failing this read used to drop every hit on the floor (byId empty => every
  // row filtered out), turning a hydration failure into "no results" after the
  // ranking had already succeeded.
  const rows = unwrapList(
    await supabase
      .from('content_chunks')
      .select('id, entry_id, content, heading, anchor, char_start')
      .in('id', ids),
    'hydrate:content_chunks'
  )
  const byId = new Map(rows.map((r) => [r.id, r]))
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
  const hits = unwrapList(
    await supabase.rpc('search_chunks', {
      query_embedding: embedding,
      query_text: q,
      match_count: topK,
      rrf_k: RRF_K,
      trgm_threshold: TRIGRAM_THRESHOLD,
      use_trigram: useTrigram ?? shouldUseTrigram(q),
    }),
    'searchChunks:rpc'
  )
  return hydrate(supabase, hits)
}

// Uses the entry's OWN stored vectors as the query — no new embedding call.
export async function relatedTo(supabase, { entryId, topK = 5 } = {}) {
  // An empty result here is meaningful — an entry that was never chunked has no
  // vectors and genuinely has nothing related — but only once a failed read can
  // no longer arrive at the same answer.
  const mine = unwrapList(
    await supabase
      .from('content_chunks')
      .select('embedding')
      .eq('entry_id', entryId)
      .limit(1),
    'relatedTo:ownEmbedding'
  )
  const embedding = mine[0]?.embedding
  if (!embedding) return []

  const rows = unwrapList(
    await supabase.rpc('search_chunks', {
      query_embedding: embedding,
      query_text: '',
      match_count: 50,
      rrf_k: RRF_K,
      trgm_threshold: TRIGRAM_THRESHOLD,
      use_trigram: false,
    }),
    'relatedTo:rpc'
  )

  const hits = rows.filter((h) => h.entry_id !== entryId)
  const hydrated = await hydrate(supabase, hits)

  // Roll up to one best chunk per entry, then diversify by topic.
  const bestByEntry = new Map()
  for (const h of hydrated) {
    const prev = bestByEntry.get(h.entryId)
    if (!prev || h.score > prev.score) bestByEntry.set(h.entryId, h)
  }
  const rolled = [...bestByEntry.values()]

  // Only used to diversify by topic. A failed read here would silently collapse
  // every topicId to null, which quietly disables MMR's whole purpose while the
  // results still look plausible.
  const entries = unwrapList(
    await supabase
      .from('entries')
      .select('id, topic_id')
      .in('id', rolled.map((r) => r.entryId)),
    'relatedTo:topics'
  )
  const topicByEntry = new Map(entries.map((e) => [e.id, e.topic_id]))

  return mmrSelect(
    rolled.map((r) => ({ ...r, id: r.chunkId, topicId: topicByEntry.get(r.entryId) ?? null })),
    { k: topK, lambda: 0.5 }
  )
}

// Flag which entries have embeddings (rows in content_chunks). Keyword search
// can return entries that were never chunked; the marker tells the user which
// results the semantic engine can actually reach. Best-effort — on any error we
// return the entries unchanged rather than break search.
export async function annotateEmbedded(supabase, entries) {
  if (!entries?.length) return entries ?? []
  try {
    // unwrapList inside the existing catch: the best-effort behaviour is
    // unchanged, but it is now a decision this function makes about a real
    // error rather than a failure it never saw.
    const rows = unwrapList(
      await supabase
        .from('content_chunks')
        .select('entry_id')
        .in('entry_id', entries.map((e) => e.id)),
      'annotateEmbedded'
    )
    const embedded = new Set(rows.map((r) => r.entry_id))
    return entries.map((e) => ({ ...e, embedded: embedded.has(e.id) }))
  } catch {
    return entries
  }
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

  const rows = unwrapList(
    await supabase
      .from('entries')
      .select('*, entry_tags(tags(name)), topics(name)')
      .in('id', best.map((h) => h.entryId))
      .is('deleted_at', null),
    'searchChunksAsEntries:entries'
  )

  const byId = new Map(rows.map((e) => [e.id, e]))
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
