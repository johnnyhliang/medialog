# Chunk-Level Retrieval — Design Spec

**Date:** 2026-07-15
**Status:** Draft (for review)
**Supersedes:** the "Retrieval (Tier 2)" section of `2026-06-25-ai-agent-rag-design.md`. That spec's
agent/chat/tool layers are **not** in scope here (see Deferred).
**Relates to:** north-star build step ④ (related entries).
**Research basis:** [Anthropic — Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
and [Anthropic — multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system).

---

## Motivation

Today the app stores **one vector per whole entry**, built from `title + note + url` **truncated at
2000 characters**, and it does **not embed `full_text` at all**. Consequences:

- A 4,000-word article collapses into a single averaged vector. You can find "this entry is broadly
  about databases"; you cannot find "the paragraph on write-ahead logging," and you cannot jump to it.
- Article bodies (`entries.full_text`, added in `0034`) are invisible to search entirely.
- Nothing is addressable at passage level, so there is no basis for "related passages" or
  "scroll me to the match."

Two existing defects this also fixes:
- **Mistuned index.** `0024` builds `ivfflat ... with (lists = 100)`. The pgvector rule of thumb is
  `lists ≈ rows/1000`, so 100 lists targets ~100k rows. At this app's scale each list holds a handful
  of vectors and the default `probes = 1` scans ~1/100th of them — **today's semantic search is
  likely silently under-recalling.**
- **No lexical arm at all.** There is no `tsvector`, no GIN index, no `pg_trgm`; keyword search is
  `ilike` patterns (no stemming, no ranking). Pure dense vectors reliably miss exact tokens — names,
  acronyms ("VWAP", "SM2"), identifiers.

### Goals

- Retrieve **passages**, not just entries; every passage knows **how to get back to it**.
- Power **related-entries linking** and **jump-to-passage search**.
- One vector store, one index, one code path.
- Retrieval exposed as a **repeatable tool**, not a one-shot function.
- Parameters **tunable and re-runnable**, not permanent commitments.

### Non-goals (deferred)

Synthesis, the agent chat, reranking, MCP. **Retrieval only: no LLM generation at query time.**
(An LLM *is* used at index time for contextualization — see below.)

---

## Decisions and reasoning

### Contextual Retrieval (the headline)
Chunks embedded in isolation lose their context — Anthropic's example: a chunk reading *"The
company's revenue grew by 3%"* names neither company nor quarter, so it retrieves poorly. The fix,
**measured on top-20 retrieval failure rate**:

| Technique | Failure rate | Reduction |
|---|---|---|
| Baseline (chunks embedded in isolation) | 5.7% | — |
| Contextual Embeddings | 3.7% | −35% |
| **+ Contextual BM25 (hybrid) ← this spec** | **2.9%** | **−49%** |
| + Reranking (top-150 → top-20) | 1.9% | −67% *(deferred)* |

So: before embedding **and** before lexical indexing, prepend 50–100 tokens of model-generated
context situating the chunk in its document. Cost is ~**$1.02 per million document tokens**, one-time,
**provided the parent document is prompt-cached** across its chunks.

**Optimization: only contextualize chunks from multi-chunk sources.** A short note that yields one
chunk already *is* its own context — contextualizing it is pure cost for no gain. This skips the
majority of items.

### Hybrid retrieval, not pure vector
Dense vectors capture paraphrase; lexical search captures exact tokens. Fusing both is the difference
between −35% and −49% above. **Honest caveat:** Postgres full-text search (`tsvector` +
`ts_rank_cd`) is *not literally BM25* — it's a TF-IDF-family ranker. It fills the same role
(exact-term matching) and is native to your stack. If measurement later shows the lexical arm is the
bottleneck, ParadeDB's `pg_search` offers true BM25 as a drop-in upgrade.

### Retrieval is a tool, not a function
The accuracy of Claude's own past-chat search comes from **iteration**, not a better index: the model
issues a search, reads results, and re-searches with refined terms — *"a multi-step search that
dynamically finds relevant information, adapts to new findings, and analyzes results,"* versus
static RAG that gets exactly one shot. A single cosine lookup cannot recover from a bad query
embedding; an agent that can look and try again does.

So `searchChunks({ query, topK, filters })` is designed as a **stateless, repeatably-callable tool**
from day one. The UI calls it once; the future agent chat calls it many times. This costs nothing now
and is the difference between a demo and the thing you actually want.

### Cheap vs. expensive to change

| Cheap (re-run the chunker) | Expensive (full re-embed / index rebuild) |
|---|---|
| chunk target size, bounds, overlap | embedding **model** and **dims** |
| similarity threshold, top-k, RRF `k` | **taskType** (baked into stored vectors) |
| merge/split aggressiveness | index type (rebuild only, no re-embed) |
| contextualizer prompt | — |

**Chunks are derived data, not user data** — the library can be re-chunked with one command. Sizing
knobs live in one config module and are expected to be tuned empirically.

### Parameters (defaults, tunable)
- **Target ~250 words, bounded 150–350.** Smaller than typical RAG defaults on purpose: the goal is
  *find the passage*, not stuff an LLM with context.
- **Bounds are enforced**, which is what makes structure-first viable: heading sections vary wildly
  (30 words vs 2,000). Unbounded, similarity scores stop being comparable — a tiny chunk scores
  spuriously high, a huge one dilutes. **Merge sections under 150 words forward; split over 350.**
- **~15% overlap** on window splits.
- **Model: `gemini-embedding-001` at 1536 dims** — unchanged. Anthropic's testing found Gemini
  embeddings among the most effective, so this is a good default to keep.
- **`taskType`: `RETRIEVAL_DOCUMENT` storing, `RETRIEVAL_QUERY` searching.** Currently unset, so
  documents and queries embed identically — a free quality win. *Verify field name/values against
  current Gemini docs at implementation.*
  - **Known compromise:** related-entries compares doc↔doc, where `SEMANTIC_SIMILARITY` is
    technically correct. Storing a second vector per chunk would fix it at double the cost/storage.
    **Decision: accept the mismatch, measure with the eval harness, revisit only if related quality
    is visibly poor.**
- **Index: HNSW**, not ivfflat — better recall at this scale, no `lists`/`probes` to mistune.
- **RRF constant k = 60** (standard).

---

## Data model

### `content_chunks` (new — the single vector store)

```
id          uuid pk
user_id     uuid not null            -- RLS owner-scoped
entry_id    uuid not null references entries(id) on delete cascade
source      text  not null           -- 'full_text' | 'note' | 'takeaway'
position    int   not null           -- chunk order within (entry_id, source)
heading     text                     -- section heading, when structural
anchor      text                     -- heading slug — the id rehype-slug renders (jump target)
char_start  int                      -- offset into source text (jump target for plain text)
content     text  not null           -- the chunk itself (shown to the user)
context     text                     -- model-generated situating context; null for single-chunk sources
word_count  int   not null
source_hash text  not null           -- hash of source text; skip re-work when unchanged
embedding   vector(1536)             -- embedding of (context || content)
tsv         tsvector                 -- generated from (context || content); the lexical arm
created_at  timestamptz default now()
```

- **HNSW** index: `using hnsw (embedding vector_cosine_ops)`.
- **GIN** index on `tsv`.
- Index on `(entry_id, source)`; unique on `(entry_id, source, position)`.
- RLS: own-rows on `user_id`.
- **Deep-topic takeaways are entries**, so `entry_id` covers them; `source = 'takeaway'`.
- `content` is what the user sees; `context` exists only to improve retrieval. Keep them separate
  columns so snippets never show machine-written preamble.

### Retired after backfill
`entry_embeddings`, its ivfflat index, and the `match_entries` RPC.

---

## Chunking & indexing

### `src/lib/chunkContent.js` (pure, unit-testable — the heart)

`chunkContent(text, { markdown }) → [{ heading, anchor, content, position, charStart, wordCount }]`

Structure-first hybrid:
- **Markdown** (notes, takeaways): split on headings; each section carries its `heading` and its
  **`anchor` slug computed with the same `github-slugger` used by `src/lib/markdownOutline.js`**, so
  an anchor always matches a real DOM id in `MarkdownView`. Then enforce bounds: merge <150-word
  sections forward, window-split >350-word sections.
- **Plain text** (fetched `full_text`): slide ~250-word windows with ~15% overlap, recording
  `charStart`.

**Every non-empty entry produces at least one chunk** — unification requires it. The
`NOTE_CHUNK_THRESHOLD` (~1500 chars) does **not** decide *whether* a note is indexed, only whether
it's **split**:

| Source | Indexed? | Split? | Contextualized? |
|---|---|---|---|
| `full_text` | always | always (windowed) | yes (multi-chunk) |
| `takeaway` | always | only if > `MAX_WORDS` | only if it split |
| `note` ≤ ~1500 chars | always | no — one chunk (`position 0`) | no (already self-contained) |
| `note` > ~1500 chars | always | yes (structure-first) | yes |

### `src/lib/chunkConfig.js`
`TARGET_WORDS`, `MIN_WORDS`, `MAX_WORDS`, `OVERLAP_RATIO`, `NOTE_CHUNK_THRESHOLD`,
`MATCH_THRESHOLD`, `MATCH_COUNT`, `RRF_K`, `EMBED_DIMS`, `TASK_TYPE_DOCUMENT`, `TASK_TYPE_QUERY`,
`MAX_CHUNKS_PER_SOURCE`, `CONTEXTUALIZE_MIN_CHUNKS`.

### `chunk-entry` edge function
Per entry, for each applicable source:
1. `chunkContent(...)`.
2. **Contextualize** (only when the source produced ≥ `CONTEXTUALIZE_MIN_CHUNKS`): for each chunk,
   one cheap-model call with the **whole document cached** + the chunk, returning 50–100 tokens of
   situating context. Prompt/context caching is what makes this ~$1/M tokens instead of brutal —
   the parent document must be cached once per document, not re-sent per chunk. Reuses the existing
   `ai` edge function.
3. **Embed** `context || content` with `RETRIEVAL_DOCUMENT`, batched.
4. Upsert, replacing that `(entry_id, source)`'s chunks. Skipped entirely when `source_hash` matches.

Trigger: async fire-and-forget on write (create/update where `note`/`full_text`/`takeaway` changed) —
replacing today's `embedEntryAsync`.

### `scripts/rechunk.js`
Re-chunk + re-embed the library (or one entry) on demand — what makes the knobs safe to tune.
**Batch** embedding calls (not the current 500ms serial drip, which would take hours over tens of
thousands of chunks). Resumable; reports progress.

---

## Retrieval

### `search_chunks(query_embedding, query_text, match_count)` — one RPC, hybrid inside
1. **Vector arm:** cosine over `content_chunks` (HNSW), top ~50.
2. **Lexical arm:** `websearch_to_tsquery` against `tsv`, ranked by `ts_rank_cd`, top ~50.
3. **Fuse with RRF:** `score = Σ 1/(RRF_K + rank_i)` across both arms; return top `match_count`
   with `chunk_id, entry_id, similarity, rank`.

RLS-scoped. Replaces `match_entries`.

### `src/lib/db/retrieval.js` — the tool-shaped interface
`searchChunks({ query, topK, filters })` — embeds the query once (`RETRIEVAL_QUERY`), calls
`search_chunks`, returns passages with parent + anchor. **Stateless and repeatably callable**: the UI
calls it once; the future agent calls it in a loop with refined queries.

`relatedTo({ entryId, topK })` — uses the entry's **existing** chunk vectors as the query (no new
embedding call), finds nearest chunks in *other* entries, then:
- rolls up to parent entries (best-scoring chunk per entry),
- applies **MMR (Maximal Marginal Relevance)** so results are *related but not redundant* — pure
  cosine surfaces near-duplicates restating the same idea, which defeats the point of connecting
  across subjects,
- excludes self, returns top ~5 with the matching passage snippet.

---

## UI consumers

- **Related footer** on `EntryCard` and deep-topic takeaways: top ~5 related items, each showing the
  matching passage snippet; click to open.
- **Explore search → passage results**: each hit renders its matching passage; clicking scrolls to it
  (anchor → `scrollIntoView` on that heading id, the mechanism `MarkdownOutline` already uses;
  `char_start` → scroll the reader to the offset and highlight).

---

## Migration path (data is kept — nothing may lose searchability)

Order matters:
1. Ship `content_chunks` + HNSW + GIN + `search_chunks` (old path untouched and live).
2. Run `scripts/rechunk.js` over **all** existing entries. Verify: every non-empty, non-deleted entry
   has ≥1 chunk.
3. Repoint `searchSemantic` → `searchChunks`; replace `embedEntryAsync` → `chunk-entry`.
4. **Only then** drop `entry_embeddings`, its index, and `match_entries` (separate migration).

Search keeps working throughout; the old path is removed only once the new one is proven populated.

---

## Evaluation (measure, don't argue)

`src/lib/retrievalEval.js` + a fixture of **~20 real queries** with expected hits (Anthropic's own
guidance: start small, ~20 queries representing real usage — effect sizes at this stage are large
enough to see immediately). Reports **top-k retrieval failure rate** (the metric the numbers above
use), plus recall@5 and MRR. Purpose is comparative: run before/after a parameter change.

## Testing

- `chunkContent`: heading split; merge of undersized sections; window-split of oversized; plain-text
  overlap and `charStart`; anchors matching `markdownOutline` slugs; short note → exactly one chunk;
  empty input.
- Contextualization gating: single-chunk sources are **not** contextualized.
- `source_hash` unchanged → no re-embed.
- Retrieval: RRF fusion ordering; roll-up to best-per-entry; MMR drops a near-duplicate; self excluded.

---

## Deferred (own specs)

- **Synthesis + the Claude-cowork-style agent chat** — scripts, skill-driven file edits, whole-app
  access, prior-chat search, web search. It will *consume* `searchChunks` as a tool, calling it
  iteratively. This spec's tool-shaped interface exists to make that clean.
- **Reranking** — the measured path from −49% to −67%. Add only when the eval says the fused top-20
  is the bottleneck; it adds runtime latency and cost.
- **True BM25** via ParadeDB `pg_search`, if the Postgres-FTS lexical arm proves weak.
- **Second vector per chunk** (`SEMANTIC_SIMILARITY`) for related-entries, if measurement demands.
- **Re-seed affordance**: interview/feed seed buttons render only in the empty state, so a starter
  pack can't be re-triggered once non-empty. Unrelated to retrieval; noted so it isn't lost.

## Honest ceiling

**Cosine similarity is not conceptual connection.** Embeddings find surface-semantic similarity;
genuine cross-domain analogy ("this order-book idea mirrors this systems idea") is what embeddings
are weakest at. This layer will be genuinely good at *"more about this"* and *"find the passage,"*
and mediocre at *"surprising connection."* That ceiling is why the synthesis/agent layer matters —
this spec is the substrate that makes it possible, not a substitute for it.

## Open questions

- Exact Gemini `taskType` field name/values for `gemini-embedding-001` — verify at implementation;
  the design holds regardless of spelling.
- Which cheap model for contextualization (Claude Haiku vs Gemini Flash) — decide on cost/caching
  behaviour at implementation. The requirement is firm: **the parent document must be cached across
  its chunks**, or contextualization gets expensive fast.
