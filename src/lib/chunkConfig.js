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
export const CONTEXTUALIZE_BATCH_SIZE = 8 // chunks per contextualizer call

export const EMBED_DIMS = 1536
export const TASK_TYPE_DOCUMENT = 'RETRIEVAL_DOCUMENT'
export const TASK_TYPE_QUERY = 'RETRIEVAL_QUERY'

export const MATCH_COUNT = 20
export const RRF_K = 60
export const TRIGRAM_THRESHOLD = 0.3
export const TRIGRAM_MAX_QUERY_WORDS = 4 // trigram is noisy on long queries
