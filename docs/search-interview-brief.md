# MediaLog retrieval — what to know if someone asks

Everything below is true of the system as built, with real numbers from the real
corpus. Nothing here is aspirational.

---

## The 60–90 second answer

> MediaLog is a personal knowledge log — about 1,300 entries, 4,976 chunks across
> 396 documents. Search is hybrid: a vector arm over pgvector, a Postgres
> full-text arm, and a trigram arm for misspellings, all fused in SQL with
> reciprocal rank fusion, then re-ranked with MMR so the results are five
> different ideas instead of one idea five times.
>
> The hard part wasn't the ranking — that's fairly standard. It was that **in a
> retrieval system, failure doesn't look like an error, it looks like an empty
> result.** I shipped contextual retrieval, and a script read its API keys from
> the wrong place, so the feature silently no-opped and 4,971 chunks were written
> with no context. Same dimensions, same shape, no exception — a context-free
> chunk is indistinguishable from a good one. The script even warned; the warning
> scrolled past. I only found it by querying the database directly.
>
> That changed how I build this kind of system. I went through every layer asking
> one question: *does failure here look like absence?* A failed embedding call
> used to return null, which the search turned into "no results" — so an outage
> of the embedding service was indistinguishable from "your library has nothing
> on this." That now throws. The contextualizer used to pad a short model
> response with empty strings; it now splits the batch and retries. And every
> entry carries an index status so an unsearchable note is visible instead of
> just missing.

Then stop. The two follow-ups you'll get are "how does the fusion work" and "how
do you know it's better" — both below.

---

## The stack

| Layer | Choice |
|---|---|
| Store | Postgres (Supabase) + pgvector |
| Embeddings | 1536-dim, asymmetric task types — `RETRIEVAL_DOCUMENT` at index time, `RETRIEVAL_QUERY` at search time |
| Vector index | HNSW on `content_chunks.embedding` |
| Lexical index | GIN on a generated `tsvector` |
| Fuzzy index | trigram index on chunk content |
| Fusion | Reciprocal rank fusion, in SQL, inside one RPC |
| Re-rank | MMR, client-side, diversity by topic |

Retrieval is chunk-level, not entry-level. Results carry the passage that
actually matched, and `bestPerEntry` rolls them up when the UI wants entries.

---

## How the fusion actually works

One SQL function, `search_chunks`, runs three CTEs and unions them:

- **vector arm** — `embedding <=> query_embedding`, limit 50
- **lexical arm** — `ts_rank_cd(tsv, websearch_to_tsquery('english', q))`, limit 50
- **fuzzy arm** — `similarity(content, q) > 0.3`, limit 50, only when enabled

Each arm contributes `1.0 / (rrf_k + rank)` with `rrf_k = 60`; scores are summed
per chunk and the top `match_count` (20) come back.

**Why RRF and not a weighted score blend** — this is the question worth being
crisp on. Cosine distance and `ts_rank_cd` are not on comparable scales, and
`ts_rank_cd` is not even bounded in a useful way. Adding or weighting them means
inventing a conversion that has no principled value and drifts as the corpus
changes. RRF throws the scores away and uses only rank position, so the arms
never need to agree on units. `k = 60` damps the head so the first result of a
weak arm cannot dominate the third of a strong one.

**Why the trigram arm is gated** — `shouldUseTrigram` only enables it for queries
of 4 words or fewer. Trigram rescues a short misspelled lookup, and is noise on
prose, where it matches on shared common substrings.

**Why no similarity percentage in the UI** — the fused score is ~0.01–0.05. It is
a rank artifact, not a 0–1 similarity, so `similarity` is returned as null
rather than rendered as a confidence the number does not carry.

---

## MMR, and what it is actually for

Pure cosine returns near-duplicates — five passages restating one idea. That
defeats the point of a personal knowledge base, which is connecting *across*
subjects. `mmrSelect` penalises a candidate whose topic is already represented
(`lambda = 0.5`), so diversity is measured on the dimension that matters here
rather than on vector distance.

`relatedTo` uses an entry's own stored vectors as the query — no new embedding
call — then rolls up to one best chunk per entry before diversifying.

---

## Chunking

Markdown-structure-aware first, windows only as a fallback:

- target 250 words, hard bounds 150–350
- sections under the minimum merge forward; sections over it window-split with
  15% overlap
- headings and GitHub-style anchors are preserved so a result can deep-link to
  the passage
- `MAX_CHUNKS_PER_SOURCE = 200` bounds the cost of an outlier document

Measured shape of the real corpus: median 8 chunks per document, p75 18, p90 31,
p95 41, max 67.

---

## Contextual retrieval, and the cost lever

Anthropic's technique: before embedding, an LLM writes 1–2 sentences situating
each chunk inside its source document, and that context is prepended. Published
result is roughly a 35% cut in retrieval failures, ~49% combined with a lexical
arm.

**The counterintuitive cost fact, and the best "I measured it" story:**
contextualisation is **~93% of total indexing cost** — 8.05M input tokens against
2.37M for the embeddings themselves. The reason is structural: there is no prompt
caching on the passthrough, so the *entire document* is re-sent with every batch
call. **Cost scales with the number of calls, not the number of chunks.**

So the batch size is the single biggest lever, and it was chosen from the
distribution above rather than picked:

| batch | calls | per document |
|---|---|---|
| 8 | 798 | 2.20 (previous) |
| 20 | 468 | 1.29 |
| **32** | **397** | **1.10** (chosen) |
| 50 | 369 | 1.02 |

32 covers 90% of documents in a single call and roughly halves cost against 8.
Past 32 the curve flattens — 50 buys 7% more for a much larger single response.

**Why 32 was not safe before:** a model asked for 32 contexts sometimes returns
20 and stops. The old code padded the remainder with empty strings — silent
degradation again. `contextualizeBatch` now halves and retries a short response,
bounded by recursion depth. That fix is what made the larger batch usable.

---

## The failure mode that defines the system

Say this plainly, because it is the actual engineering insight:

> In a retrieval system, a bug does not surface as an error. It surfaces as a
> plausible, empty, or slightly-worse result — and no one can tell the difference
> from the outside.

Three instances, all real, all fixed:

1. **4,971 context-free chunks.** `rechunk.js` read `AI_BASE_URL` / `AI_API_KEY`
   from `process.env`; they existed only as Supabase secrets. `canContextualize`
   was permanently false. The script warned and the warning scrolled past. Now it
   reads `.env.local` and **refuses to run** without the AI vars unless you pass
   `--no-context` — degrading became a choice you make out loud.
2. **Short contextualizer responses padded with `''`.** Same invisibility. Fixed
   with split-and-retry.
3. **A failed embed returned null**, which `searchChunks` turned into an empty
   result — so an embedding outage was indistinguishable from "your library has
   nothing on this." It now throws. A *successful* call returning no embedding
   still yields null, because that is a real "cannot embed this", not a failure.

The same reasoning produced `index_status` on every entry (`0068`): indexing is
fire-and-forget so it can never break a save, but errors were being swallowed
with no status written, leaving a note permanently unsearchable and no signal
anywhere. The user's conclusion would be *"I guess I never saved that"* — the
worst possible outcome for a knowledge base. The health UI deliberately renders
**nothing** when healthy, because a green tick for a background process is noise,
and noise trains you to ignore the one time it matters.

---

## How you know it is better

`src/lib/retrievalEval.js` — a comparative harness run before and after any
`chunkConfig` change, scoring:

- **failureRate** — share of queries where no expected result appears in top-k.
  Chosen because it is the metric Anthropic's contextual-retrieval numbers use,
  so results are comparable to the published figures.
- **recall@5**
- **MRR**

Be honest about the limit if asked: the fixture is small and hand-built, so it
catches regressions rather than proving absolute quality.

---

## Numbers worth memorising

- 1,345 entries · 4,976 chunks · 396 documents · 98% of chunkable entries indexed
- 1536 dims · RRF k=60 · 3 arms × 50 candidates → top 20 · MMR λ=0.5
- chunk 250 words target, 150–350 bounds, 15% overlap
- one 2-chunk note $0.0009 · 500-note import $0.42 · full re-index $5.34
- contextualisation ≈ 93% of indexing cost

---

## Known gaps — say these before they are found

- **Only 5 of 4,976 chunks currently carry context.** The incident is fixed;
  the backfill is deliberately deferred rather than forgotten.
- **Article preservation covers 1 of 957 URL entries, and that is correct.** 948
  of the 956 unpreserved are bare bookmarks — GitHub (248), YouTube (185), Reddit
  (88), LeetCode (57) — where Readability has nothing to extract. Backfilling
  would fill the index with README boilerplate and "Sign in to continue". Any
  future backfill filters to entries with a note or takeaway, because user
  annotation is the only cheap signal a URL was read rather than parked.
- **No job queue.** Indexing is fire-and-forget on the request path; a `jobs`
  table and two-phase indexing (embed now, contextualise later) are designed and
  not built.
- **No chunk-level dedup.**

Naming the gaps unprompted reads as ownership. Pretending they are not there
reads as not having looked.
