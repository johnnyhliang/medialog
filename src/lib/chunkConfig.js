// Every retrieval knob lives here. Chunks are DERIVED data — re-run
// scripts/rechunk.js after changing any sizing value. Model/dims/taskType are
// the expensive ones: changing them requires a full re-embed.

export const TARGET_WORDS = 250          // aim; bounds below are what's enforced
export const MIN_WORDS = 150             // smaller sections merge forward
export const MAX_WORDS = 350             // larger sections get window-split
export const OVERLAP_RATIO = 0.15        // window overlap, plain text
export const NOTE_CHUNK_THRESHOLD = 1500 // chars; controls SPLITTING, not indexing
export const MAX_CHUNKS_PER_SOURCE = 200 // bound cost on outlier documents

export const CONTEXTUALIZE_MIN_CHUNKS = 2 // 1 chunk is already its own context

// Chunks per contextualizer call. This is the single largest cost lever in the
// whole pipeline, because the ENTIRE document is re-sent with every call — so
// cost scales with the number of calls, not the number of chunks.
//
// Measured against the real corpus (4,976 chunks / 396 documents, 2026-07-30):
//   chunks per document: median 8, p75 18, p90 31, p95 41, max 67
//
//   batch  8 -> 798 calls (2.20 per document)   <- previous value
//   batch 20 -> 468 calls (1.29 per document)
//   batch 32 -> 397 calls (1.10 per document)   <- chosen
//   batch 50 -> 369 calls (1.02 per document)
//
// 32 covers 90% of documents in a single call, which halves contextualisation
// cost against 8. Past 32 the curve flattens — 50 buys 7% more for a much larger
// single response. The reason it was ever this low is that a batch too large for
// the model to answer completely used to degrade SILENTLY; contextualize.js now
// splits and retries a short response instead, which is what makes 32 safe.
export const CONTEXTUALIZE_BATCH_SIZE = 32

export const EMBED_DIMS = 1536
export const TASK_TYPE_DOCUMENT = 'RETRIEVAL_DOCUMENT'
export const TASK_TYPE_QUERY = 'RETRIEVAL_QUERY'

export const MATCH_COUNT = 20
export const RRF_K = 60
export const TRIGRAM_THRESHOLD = 0.3
export const TRIGRAM_MAX_QUERY_WORDS = 4 // trigram is noisy on long queries
