# Chunk-Level Retrieval — Design Spec

**Date:** 2026-07-15
**Status:** Draft (for review)
**Supersedes:** the "Retrieval (Tier 2)" section of `2026-06-25-ai-agent-rag-design.md`. That spec's
agent/chat/tool layers are **not** in scope here (see Deferred).
**Relates to:** north-star build step ④ (related entries).

---

## Motivation

Today the app stores **one vector per whole entry**, built from `title + note + url` **truncated at
2000 characters**, and it does **not embed `full_text` at all**. Consequences:

- A 4,000-word article collapses into a single averaged vector. You can find "this entry is broadly
  about databases"; you cannot find "the paragraph on write-ahead logging," and you cannot jump to it.
- Article bodies (`entries.full_text`, added in `0034`) are invisible to search entirely.
- Nothing is addressable at passage level, so there is no basis for "related passages" or
  "scroll me to the match."

Separately, an existing defect: `0024` builds `ivfflat ... with (lists = 100)`. The pgvector rule of
thumb is `lists ≈ rows/1000`, so 100 lists targets ~100k rows. At the app's actual scale (a few
thousand), each list holds a handful of vectors and the default `probes = 1` scans ~1/100th of them —
**today's semantic search is likely silently under-recalling.**

This spec replaces whole-entry embedding with **passage-level chunk retrieval**, and fixes the index
and embedding task type along the way.

### Goals

- Split long content into passages, embed each, and retrieve **passages** — not just entries.
- Every passage knows **how to get back to it** (a heading anchor or a character offset), enabling
  jump-to-passage.
- Power **related-entries linking** (concept connection across subjects) from existing vectors.
- One vector store, one index, one code path.
- Make chunking parameters **tunable and re-runnable**, not permanent commitments.

### Non-goals (deferred — see Deferred section)

Synthesis, the agent chat, reranking, and MCP. This spec is **retrieval only: no LLM generation.**

---

## Decisions and their reasoning

### Unify, don't augment
`content_chunks` becomes the **single vector store**. Long content → many chunks; short content →
exactly one chunk (`position 0`). `entry_embeddings` and `match_entries` are **retired** after
backfill. Rationale: the only argument for a second table was avoiding disruption to existing data;
since all existing entries are being re-embedded anyway (for the corrected `taskType`), keeping two
tables would leave permanent merge logic in every query for no benefit.

### Cheap vs. expensive to change
This framing drives what we agonize over:

| Cheap (re-run the chunker) | Expensive (full re-embed / index rebuild) |
|---|---|
| chunk target size, bounds, overlap | embedding **model** and **dims** |
| similarity threshold, top-k | **taskType** (baked into stored vectors) |
| merge/split aggressiveness | index type (rebuild only, no re-embed) |

**Chunks are derived data, not user data** — the whole library can be re-chunked with one command.
So sizing knobs live in one config module and are expected to be tuned empirically. The sticky
choices (model, dims, taskType) are fixed here deliberately.

### Parameters (defaults, tunable)
- **Target ~250 words per chunk, bounded 150–350.** Smaller than typical RAG defaults on purpose:
  the goal is *find the passage*, not stuff an LLM with context. Precision beats context here.
- **Bounds are enforced**, which is what makes structure-first viable: heading sections vary wildly
  (30 words vs 2,000). Unbounded, similarity scores stop being comparable across chunks — a tiny
  chunk scores spuriously high, a huge one dilutes. So: **merge sections under 150 words into the
  next; split sections over 350.**
- **~15% overlap** on window splits, so an idea straddling a boundary is fully captured by at least
  one chunk.
- **Model: `gemini-embedding-001` at 1536 dims** — unchanged, so the column type and existing tooling
  hold.
- **`taskType`: `RETRIEVAL_DOCUMENT` when storing, `RETRIEVAL_QUERY` when searching.** The current
  `embed-entry` sets neither, embedding documents and queries identically. Asymmetric task types are
  a free retrieval-quality win. *Verify the exact field/values against current Gemini docs at
  implementation time.*
- **Index: HNSW**, not ivfflat — better recall at this scale with no `lists`/`probes` tuning to get
  wrong.

---

## Data model

### `content_chunks` (new — the single vector store)

```
id          uuid pk
user_id     uuid not null            -- RLS owner-scoped (entry_embeddings had an RLS gap; 0029 patched it)
entry_id    uuid not null references entries(id) on delete cascade
source      text  not null           -- 'full_text' | 'note' | 'takeaway'
position    int   not null           -- chunk order within (entry_id, source)
heading     text                     -- section heading, when structural
anchor      text                     -- heading slug — the same id rehype-slug renders (jump target)
char_start  int                      -- offset into the source text (jump target for plain text)
content     text  not null           -- the chunk itself
word_count  int   not null
source_hash text  not null           -- hash of the source text; skip re-embedding when unchanged
embedding   vector(1536)
created_at  timestamptz default now()
```

- HNSW index: `using hnsw (embedding vector_cosine_ops)`.
- Index on `(entry_id, source)`; unique on `(entry_id, source, position)`.
- RLS: own-rows on `user_id`.
- **Deep-topic takeaways are entries**, so `entry_id` covers them; `source = 'takeaway'`.

### Retired after backfill
`entry_embeddings` table, its ivfflat index, and the `match_entries` RPC.

---

## Chunking

### `src/lib/chunkContent.js` (pure, unit-testable — the heart)

`chunkContent(text, { markdown }) → [{ heading, anchor, content, position, charStart, wordCount }]`

Structure-first hybrid:
- **Markdown** (notes, takeaways): split on headings — each section is a candidate chunk, carrying its
  `heading` and its **`anchor` slug computed with the same `github-slugger` used by
  `src/lib/markdownOutline.js`**, so an anchor always matches a real DOM id in `MarkdownView`.
  Then apply bounds: merge <150-word sections forward, window-split >350-word sections.
- **Plain text** (fetched `full_text`): no headings to trust — slide ~250-word windows with ~15%
  overlap, recording `charStart` for each.

**Every non-empty entry produces at least one chunk** — unification requires it, since
`entry_embeddings` is going away and there is nowhere else for a short note to live. The
`NOTE_CHUNK_THRESHOLD` (~1500 chars) does **not** decide *whether* a note is indexed; it decides only
whether the note is **split**:

| Source | Indexed? | Split? |
|---|---|---|
| `full_text` | always | always (windowed) |
| `takeaway` | always | only if over `MAX_WORDS` |
| `note` ≤ ~1500 chars | always | no — stored as exactly one chunk (`position 0`) |
| `note` > ~1500 chars | always | yes — structure-first hybrid |

### `src/lib/chunkConfig.js`
All knobs in one place: `TARGET_WORDS`, `MIN_WORDS`, `MAX_WORDS`, `OVERLAP_RATIO`,
`NOTE_CHUNK_THRESHOLD`, `MATCH_THRESHOLD`, `MATCH_COUNT`, `EMBED_DIMS`, `TASK_TYPE_DOCUMENT`,
`TASK_TYPE_QUERY`.

### Pipeline
- **`chunk-entry` edge function**: given an entry, chunk each applicable source, embed each chunk
  (`RETRIEVAL_DOCUMENT`), and replace that `(entry_id, source)`'s chunks transactionally.
  Skips work when `source_hash` is unchanged.
- **Trigger**: async fire-and-forget on write (create/update where `note`/`full_text`/`takeaway`
  changed) — same pattern as today's `embedEntryAsync`, which this replaces.
- **`scripts/rechunk.js`**: re-chunk + re-embed the whole library (or one entry) on demand. This is
  what makes the sizing knobs safe to tune. Rate-limited (~500ms) like the existing backfill script.

---

## Retrieval

### `match_chunks(query_embedding vector(1536), match_threshold float, match_count int)`
Cosine over `content_chunks`, RLS-scoped, returns `chunk_id, entry_id, similarity`. Replaces
`match_entries`.

### Two consumers

**1. Related entries (concept connection).** Given an entry, use its **existing** chunk vectors as
the query — no new embedding call — find nearest chunks belonging to *other* entries, roll up to
parent entries taking each entry's best-scoring chunk, exclude self, return top ~5 with the matching
passage snippet.

**2. Jump-to-passage search.** Embed the query once (`RETRIEVAL_QUERY`) → `match_chunks` → each hit
carries `entry_id` plus `anchor`/`char_start`. Clicking opens the entry (or reader) and scrolls:
anchor → `scrollIntoView` on that heading id (the mechanism `MarkdownOutline` already uses);
`char_start` → scroll the reader to that offset and highlight the passage.

---

## UI consumers

- **Related footer** on `EntryCard` and deep-topic takeaways: top ~5 related items, each showing the
  matching passage snippet; click to open. This is the concept-connection layer.
- **Explore semantic search → passage results**: each hit renders its matching passage snippet;
  clicking scrolls to it.

---

## Migration path (data is being kept — nothing may lose searchability)

Order matters:
1. Ship `content_chunks` + HNSW index + `match_chunks` (old path still live and untouched).
2. Run `scripts/rechunk.js` over **all** existing entries — re-embeds with the corrected `taskType`
   and populates chunks. Verify counts (every non-empty, non-deleted entry has ≥1 chunk).
3. Repoint `searchSemantic` to `match_chunks`; replace `embedEntryAsync` with the `chunk-entry` call.
4. Only then drop `entry_embeddings`, its index, and `match_entries` (a separate migration, once
   step 2 is verified).

Search keeps working throughout; the old path is removed only after the new one is proven populated.

---

## Evaluation (measure, don't argue)

`src/lib/retrievalEval.js` + a small fixture: ~10 real queries with their expected entries/passages.
Prints recall@5 / MRR against the live index. Purpose is comparative — run it before and after a
parameter change to see whether the change helped. This is what turns threshold/size from opinion
into measurement.

## Testing

- `chunkContent`: heading split; merge of undersized sections; window-split of oversized sections;
  plain-text windows with correct overlap and `charStart`; anchors matching `markdownOutline`'s
  slugs; short note → exactly one chunk; empty/whitespace input.
- Retrieval roll-up: chunk hits collapse to best-per-entry, self excluded.
- `chunk-entry`: `source_hash` unchanged → no re-embed.

---

## Deferred (own specs)

- **Synthesis + the Claude-cowork-style agent chat** — an agentic assistant that scripts, edits files
  via skills, pulls from the whole app, searches prior chats, and does web search. It will *consume*
  this retrieval layer. Explicitly bigger than the `2026-06-25` RAG spec and separate from it.
- **Reranking** (cross-encoder or LLM rerank of top-20 → top-5) — only if measured precision demands it.
- **Re-seed affordance**: the interview/feed seed buttons render only in the empty state, so there's
  no way to re-trigger a starter pack once non-empty. Unrelated to retrieval; noted here so it isn't lost.

## Open questions

- Exact Gemini `taskType` field name/values for `gemini-embedding-001` — verify against current docs
  during implementation; the design holds regardless of the spelling.
- Whether `full_text` for very long articles needs a per-entry chunk cap (e.g. 200 chunks) to bound
  embedding cost on outliers. Lean: add a cap in config, default generous.
