# Indexing, index health, and the work not yet done

**2026-07-30.** Written because the pieces below were designed across several
sessions and are easy to lose track of. This is the orientation document: what
exists, what it costs, what is planned, and why. If you are picking this up cold,
read this before `PRODUCTION.md`.

---

## What "indexing" means here

Saving a note does not make it findable. Three things have to happen first:

1. **Chunk** — split the text into overlapping, heading-aware pieces
   (`src/lib/chunkContent.js`)
2. **Contextualise** — ask an LLM to write 1–2 sentences situating each chunk in
   its document (`src/lib/contextualize.js`). Anthropic's *contextual retrieval*
   technique. This is optional and expensive
3. **Embed** — turn `context + "\n\n" + chunk` into a vector, store it in
   `content_chunks` with an HNSW index

Search then does hybrid retrieval: vector similarity + full-text + trigram,
fused with RRF (`src/lib/db/retrieval.js`).

**Why context has to be embedded, not attached:** the context is prepended to the
text *before* the vector is computed, so the vector encodes both. Adding context
to an existing chunk means computing a new vector. There is no way to patch it in.
That is inherent to the technique — it is why "just add context later" is not an
option and why any change here means re-embedding.

---

## Index health

**The problem it solves:** indexing is fire-and-forget by design — it must never
break a save. But that contract was half-implemented: errors were swallowed and
no status was written, so a failed embed left a note permanently unsearchable
with no signal anywhere. The user's natural conclusion is *"I guess I never saved
that"*, which is the worst possible failure mode for a knowledge base.

**The mechanism** (`supabase/migrations/0068_index_status.sql`): every entry
carries `index_status`, `indexed_at`, `index_error`.

| Status | Meaning |
|---|---|
| `null` / `not_attempted` | never tried — pre-existing entries, or nothing chunkable |
| `pending` | queued or in flight |
| `ok` | chunks written |
| `empty` | nothing chunkable (no note, takeaway or full_text) |
| `failed` | attempted and errored — retryable |

**Where to see it:**

- **Your own** — `IndexStatus` / `IndexHealthBanner` components, fed by the
  `my_index_status()` RPC. Deliberately renders *nothing* when healthy: a green
  tick for a background process is noise, and noise trains you to ignore the one
  time it matters.
- **Any account** — Metrics dashboard → **inspect** on an account row. Shows the
  status breakdown, the last index errors verbatim, and preservation coverage
  alongside it.
- **Whole corpus, from the CLI** — `node scripts/check-preservation.js` (that one
  covers article preservation, which is a separate pipeline; see below).

**Current state of the corpus (measured 2026-07-30):** 4,976 chunks across 396
documents, 98% of chunkable entries indexed. **Only 5 chunks have context** — see
the incident below.

---

## The contextual-retrieval incident

`scripts/rechunk.js` read `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` from
`process.env`, but those exist only as Supabase secrets. `canContextualize` was
therefore always false, and 4,971 chunks were written with no context.

The script *did* warn. The warning scrolled past — and **a context-free chunk is
indistinguishable from a good one**: same shape, same dimensions, no error. The
damage was invisible until the DB was inspected directly.

**Fixed** (`944a51b`): the script now reads `.env.local`, and *refuses to run*
without the AI vars unless you pass `--no-context` explicitly. Degrading is now a
choice you have to make out loud.

**Not yet fixed:** the 4,971 chunks are still context-free. Deliberately — see
"do not re-index yet" below.

---

## Article preservation — a separate pipeline, often confused with indexing

`full_text` preservation fetches the page and extracts the article body
(`_shared/extractArticle.ts`, Readability → regex heuristic → give up). It feeds
indexing but is not the same thing, and it has its own status column
(`full_text_status`) and its own checker (`scripts/check-preservation.js`).

**Coverage is 1/957 URL entries, and that is fine.** 948 of the 956 unpreserved
are bare bookmarks with no note — github.com (248), YouTube (185), reddit (88),
leetcode (57). Readability has nothing to extract from those, and backfilling
would fill the index with README boilerplate and "Sign in to continue".
**Any future backfill should filter to entries with a note or takeaway** — user
annotation is the only cheap signal that a URL was read rather than parked.

---

## Measured costs (2026-07-30, real corpus)

| | Cost |
|---|---|
| One 2-chunk note | $0.0009 |
| 100 notes | $0.09 |
| Import 500 notes | $0.42 |
| Full re-index of the current corpus | $5.34 |

**Contextualisation is ~93% of indexing cost** — 8.05M input tokens vs 2.37M for
the embeddings. The reason is structural: the whole document is re-sent once per
batch of 8 chunks.

---

## Planned work, in order

### 1. Raise `CONTEXTUALIZE_BATCH_SIZE` — NOT YET DONE

`src/lib/chunkConfig.js`, currently 8. Raising it to ~20 cuts document re-sends
by roughly 60% for a modest quality risk. One line, largest cost lever available.
Check whether the AI provider supports prompt caching on the document block
first — it is byte-identical across batches, which would collapse the cost
further and make the batch size much less important.

### 2. Eval fixture — NOT YET DONE

`src/lib/retrievalEval.js` already exists: `runEval` executes queries against the
real retrieval path, `scoreRun` computes `failureRate` / `recallAt5` / `mrr`
against a fixture, using the same failure-rate metric as Anthropic's published
contextual-retrieval numbers.

**What is missing is the fixture** — roughly 20 pairs of *(query, entry that
should come back)* drawn from the real library. Half a day of work.

**Then:** baseline → re-index with context → re-run → compare.

**Do not re-index before this exists.** $5.34 is affordable; spending it without a
baseline means never learning whether contextual retrieval helped, and that is
the only question that decides whether to keep paying for it on every import.

### 3. `jobs` table — NOT YET DONE (task #5, the keystone)

```
jobs(id, user_id, kind, payload, state, attempts, run_after, created_at)
     kind ∈ 'index' | 'preserve'
```

One table for both job types — preservation needs exactly this too, and building
two queues is the actual waste. Claim rows with `for update skip locked` so
concurrent workers cannot double-spend embeddings. Drain with `pg_cron` hitting
an edge function; no long-lived process.

Unblocks three things at once: invisible indexing, safe bulk import, and the
ability to meter indexing without silently degrading search.

### 4. Two-phase indexing — NOT YET DONE

Rides on the queue.

| Phase | When | Share of cost |
|---|---|---|
| Embed raw content | immediately, inline | ~7% |
| Contextualise + re-embed | queued, low priority | ~93% |

Search works within seconds of a save; quality arrives later, invisibly. This is
what makes contextualisation **tier-differentiable without ever degrading search
silently** — free gets phase 1, paid gets both. It also makes the expensive half
*interruptible*, so it can be paused under budget pressure and resumed.

### 5. Chunk-level dedup — NOT YET DONE

`source_hash` already prevents re-embedding an unchanged document. Extend it to
the chunk level so an edit that touches one paragraph does not re-embed the whole
note. Cheapest large win remaining.

---

## Quota design — decided, not built

`ai_usage` already meters chat and indexing separately by `function_name`, so a
shared budget is *available*. **Do not use one.**

A shared quota means importing your library exhausts your ability to ask
questions about it — the app punishing you for using its core feature, at the
exact moment you are deciding whether you like it.

- **Chat** → rolling window, visible meter, hard cap. Interactive; a user can see
  it and wait.
- **Indexing** → cost of goods sold. No user-facing cap. Queue it, drain it,
  never show a number.
- **Cost ceiling** → one per-account alert covering both, in the admin dashboard,
  not in the user's face.

**Never cap `embed-entry` on the request path.** That degrades search silently —
no error, notes just stop being findable. If a hard stop is ever needed, fail
loudly: *"N notes pending indexing"*.

---

## Making indexing invisible — the three mechanisms

1. **Queue + drain** — import completes instantly, search catches up quietly
2. **Two-phase indexing** — working search at once, better search later, no
   visible state in between
3. **Silence on the happy path** — already true: `IndexStatus` renders nothing
   when healthy, the banner appears only on real failure

**Avoid:** a spinner on save, a percentage during import, any "indexing…" state
to wait through. That is the app's problem, not the user's.
