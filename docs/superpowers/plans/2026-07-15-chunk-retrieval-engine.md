# Chunk Retrieval Engine Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the passage-level retrieval engine — chunk long content, contextualize it, embed it, and search it with a three-arm hybrid (vector + lexical + fuzzy) fused by RRF.

**Architecture:** A pure `chunkContent` lib splits content structure-first (markdown headings) or by overlapping windows (plain text). Multi-chunk sources get 50–100 tokens of model-written context prepended before embedding and indexing (Contextual Retrieval — a measured 49% reduction in retrieval failures). Everything lands in one `content_chunks` table with an HNSW vector index, a GIN tsvector index, and a GIN trigram index; `search_chunks` fuses all three arms with Reciprocal Rank Fusion. Retrieval is exposed as a stateless, repeatably-callable tool.

**Tech Stack:** Supabase (Postgres + pgvector + pg_trgm), Deno edge functions, Gemini `gemini-embedding-001` @ 1536 dims, an OpenAI-compatible `ai` passthrough for contextualization, Vite + Vitest, Node scripts.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-chunk-retrieval-design.md`.
- **Plan 1 is the engine only.** No UI, no repointing of `searchSemantic`, and **do NOT drop `entry_embeddings`** — that is Plan 2, after the backfill is verified. The old path must keep working throughout.
- Embedding model/dims are fixed: `gemini-embedding-001`, `output_dimensionality: 1536`.
- `taskType`: `RETRIEVAL_DOCUMENT` when storing, `RETRIEVAL_QUERY` when searching.
- **Every non-empty entry produces ≥1 chunk.** `NOTE_CHUNK_THRESHOLD` controls *splitting*, never *whether* a note is indexed.
- Only sources producing ≥ `CONTEXTUALIZE_MIN_CHUNKS` chunks get contextualized (a single chunk is already its own context).
- Contextualization is **batched**: one call per document per group of `CONTEXTUALIZE_BATCH_SIZE` chunks. Never one call per chunk.
- `content` (shown to users) and `context` (machine-written, retrieval-only) stay separate columns — snippets must never show generated preamble.
- All config knobs live in `src/lib/chunkConfig.js`. No magic numbers elsewhere.
- Tests: `npx vitest run <path>`. DB helpers use `src/test/mockSupabase.js`. Vitest takes ~30s to boot; be patient.
- Commit style: NO `Co-Authored-By: Claude` or `Claude-Session:` trailer. Conventional prefixes (`feat:`, `test:`).
- Migrations are sequential SQL under `supabase/migrations/`; next is `0043`.
- Do NOT run `supabase db push` or deploy functions — the user runs those after review.

---

### Task 1: Migration — `content_chunks` + three indexes + `search_chunks` RPC

**Files:**
- Create: `supabase/migrations/0043_content_chunks.sql`

**Interfaces:**
- Produces: table `content_chunks`; RPC `search_chunks(query_embedding vector(1536), query_text text, match_count int, rrf_k int, trgm_threshold float, use_trigram boolean)` returning `(chunk_id uuid, entry_id uuid, score float)`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0043_content_chunks.sql`:

```sql
-- Passage-level retrieval. Replaces whole-entry embedding (entry_embeddings is
-- dropped in a later migration, only after backfill is verified).
-- Three retrieval arms fused by RRF: vector (HNSW), lexical (tsvector), fuzzy (pg_trgm).

create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists content_chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  entry_id    uuid not null references entries(id) on delete cascade,
  source      text not null check (source in ('full_text', 'note', 'takeaway')),
  position    int  not null,
  heading     text,
  anchor      text,
  char_start  int,
  content     text not null,          -- shown to the user
  context     text,                   -- machine-written; retrieval only, never displayed
  word_count  int  not null default 0,
  source_hash text not null,
  embedding   vector(1536),
  -- lexical arm indexes context + content together
  tsv         tsvector generated always as (
                to_tsvector('english', coalesce(context, '') || ' ' || coalesce(content, ''))
              ) stored,
  created_at  timestamptz default now(),
  unique (entry_id, source, position)
);

alter table content_chunks enable row level security;
create policy "content_chunks: own rows" on content_chunks
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists content_chunks_entry_source on content_chunks (entry_id, source);
create index if not exists content_chunks_embedding_hnsw
  on content_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists content_chunks_tsv on content_chunks using gin (tsv);
create index if not exists content_chunks_content_trgm
  on content_chunks using gin (content gin_trgm_ops);

-- Hybrid search: three arms, fused by Reciprocal Rank Fusion.
-- RRF fuses on RANK, not raw score, which is why cosine / ts_rank_cd / trigram
-- similarity can combine despite being on incomparable scales.
create or replace function search_chunks(
  query_embedding vector(1536),
  query_text      text,
  match_count     int     default 20,
  rrf_k           int     default 60,
  trgm_threshold  float   default 0.3,
  use_trigram     boolean default false
)
returns table (chunk_id uuid, entry_id uuid, score float)
language sql stable
as $$
  with vector_arm as (
    select c.id, c.entry_id,
           row_number() over (order by c.embedding <=> query_embedding) as rank
    from content_chunks c
    where c.embedding is not null
    order by c.embedding <=> query_embedding
    limit 50
  ),
  lexical_arm as (
    select c.id, c.entry_id,
           row_number() over (
             order by ts_rank_cd(c.tsv, websearch_to_tsquery('english', query_text)) desc
           ) as rank
    from content_chunks c
    where query_text <> ''
      and c.tsv @@ websearch_to_tsquery('english', query_text)
    limit 50
  ),
  fuzzy_arm as (
    select c.id, c.entry_id,
           row_number() over (order by similarity(c.content, query_text) desc) as rank
    from content_chunks c
    where use_trigram
      and query_text <> ''
      and similarity(c.content, query_text) > trgm_threshold
    limit 50
  ),
  fused as (
    select id, entry_id, sum(w) as score from (
      select id, entry_id, 1.0 / (rrf_k + rank) as w from vector_arm
      union all
      select id, entry_id, 1.0 / (rrf_k + rank) as w from lexical_arm
      union all
      select id, entry_id, 1.0 / (rrf_k + rank) as w from fuzzy_arm
    ) arms
    group by id, entry_id
  )
  select id, entry_id, score
  from fused
  order by score desc
  limit match_count;
$$;
```

- [ ] **Step 2: Verify the SQL shape**

Run: `grep -c "create index if not exists" supabase/migrations/0043_content_chunks.sql`
Expected: `4`

Run: `grep -c "vector_arm\|lexical_arm\|fuzzy_arm" supabase/migrations/0043_content_chunks.sql`
Expected: `6`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0043_content_chunks.sql
git commit -m "feat: content_chunks table with vector/lexical/fuzzy indexes and RRF search"
```

---

### Task 2: `chunkConfig.js` + `chunkContent.js` (the pure core)

**Files:**
- Create: `src/lib/chunkConfig.js`
- Create: `src/lib/chunkContent.js`
- Test: `src/lib/chunkContent.test.js`

**Interfaces:**
- Consumes: `extractHeadings`-style slugging via `github-slugger` (already a dependency; `src/lib/markdownOutline.js` uses it the same way).
- Produces:
  - `chunkConfig` exports: `TARGET_WORDS`, `MIN_WORDS`, `MAX_WORDS`, `OVERLAP_RATIO`, `NOTE_CHUNK_THRESHOLD`, `MATCH_COUNT`, `RRF_K`, `EMBED_DIMS`, `TASK_TYPE_DOCUMENT`, `TASK_TYPE_QUERY`, `MAX_CHUNKS_PER_SOURCE`, `CONTEXTUALIZE_MIN_CHUNKS`, `CONTEXTUALIZE_BATCH_SIZE`, `TRIGRAM_THRESHOLD`, `TRIGRAM_MAX_QUERY_WORDS`.
  - `chunkContent(text, { markdown }) → [{ heading, anchor, content, position, charStart, wordCount }]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/chunkContent.test.js`:

```js
import { describe, test, expect } from 'vitest'
import { chunkContent } from './chunkContent.js'
import { MIN_WORDS, MAX_WORDS } from './chunkConfig.js'

const words = (n, w = 'word') => Array.from({ length: n }, () => w).join(' ')

describe('chunkContent — markdown', () => {
  test('splits on headings, carrying heading and matching anchor slug', () => {
    const md = `## Order Books\n${words(200)}\n\n## Adverse Selection\n${words(200)}`
    const out = chunkContent(md, { markdown: true })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ heading: 'Order Books', anchor: 'order-books', position: 0 })
    expect(out[1]).toMatchObject({ heading: 'Adverse Selection', anchor: 'adverse-selection', position: 1 })
  })

  test('merges an undersized section forward instead of emitting a tiny chunk', () => {
    const md = `## Tiny\n${words(10)}\n\n## Big\n${words(200)}`
    const out = chunkContent(md, { markdown: true })
    expect(out).toHaveLength(1)
    expect(out[0].content).toContain('Tiny')
    expect(out[0].wordCount).toBeGreaterThanOrEqual(MIN_WORDS)
  })

  test('splits an oversized section into bounded chunks', () => {
    const md = `## Huge\n${words(900)}`
    const out = chunkContent(md, { markdown: true })
    expect(out.length).toBeGreaterThan(1)
    for (const c of out) expect(c.wordCount).toBeLessThanOrEqual(MAX_WORDS)
  })

  test('content with no headings still yields chunks', () => {
    const out = chunkContent(words(300), { markdown: true })
    expect(out.length).toBeGreaterThanOrEqual(1)
  })
})

describe('chunkContent — plain text', () => {
  test('windows with overlap and records ascending charStart', () => {
    const out = chunkContent(words(900), { markdown: false })
    expect(out.length).toBeGreaterThan(1)
    expect(out[0].charStart).toBe(0)
    expect(out[1].charStart).toBeGreaterThan(0)
    for (const c of out) expect(c.wordCount).toBeLessThanOrEqual(MAX_WORDS)
  })

  test('overlaps consecutive windows (last words of A reappear in B)', () => {
    const out = chunkContent(words(900, 'x') + ' ' + words(1, 'BOUNDARY') + ' ' + words(900, 'y'), { markdown: false })
    const joined = out.map((c) => c.content)
    const hits = joined.filter((c) => c.includes('BOUNDARY')).length
    expect(hits).toBeGreaterThanOrEqual(1)
  })

  test('short text yields exactly one chunk at position 0', () => {
    const out = chunkContent('a short note', { markdown: false })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ position: 0, charStart: 0 })
  })

  test('empty or whitespace input yields no chunks', () => {
    expect(chunkContent('', { markdown: false })).toEqual([])
    expect(chunkContent('   \n  ', { markdown: true })).toEqual([])
    expect(chunkContent(null, { markdown: false })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chunkContent.test.js`
Expected: FAIL — `Cannot find module './chunkContent.js'`

- [ ] **Step 3: Write chunkConfig.js**

Create `src/lib/chunkConfig.js`:

```js
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
```

- [ ] **Step 4: Write chunkContent.js**

Create `src/lib/chunkContent.js`:

```js
import GithubSlugger from 'github-slugger'
import { MIN_WORDS, MAX_WORDS, TARGET_WORDS, OVERLAP_RATIO, MAX_CHUNKS_PER_SOURCE } from './chunkConfig.js'

const countWords = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)

function stripInline(s) {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Split a long body into overlapping word windows.
function windowSplit(text, baseCharStart) {
  const tokens = text.trim().split(/\s+/)
  if (!tokens.length) return []
  const step = Math.max(1, Math.round(TARGET_WORDS * (1 - OVERLAP_RATIO)))
  const out = []
  for (let i = 0; i < tokens.length; i += step) {
    const slice = tokens.slice(i, i + MAX_WORDS)
    if (!slice.length) break
    const content = slice.join(' ')
    // charStart is approximate for windows: offset of this window's first token
    const before = tokens.slice(0, i).join(' ')
    out.push({
      content,
      wordCount: slice.length,
      charStart: baseCharStart + (before ? before.length + 1 : 0),
    })
    if (i + MAX_WORDS >= tokens.length) break
  }
  return out
}

// Parse markdown into { heading, anchor, body, charStart } sections.
function markdownSections(text) {
  const slugger = new GithubSlugger()
  const lines = text.split('\n')
  const sections = []
  let cur = { heading: null, anchor: null, lines: [], charStart: 0 }
  let offset = 0
  let inFence = false

  for (const raw of lines) {
    const line = raw.trim()
    const lineLen = raw.length + 1
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence
      cur.lines.push(raw)
      offset += lineLen
      continue
    }
    const m = !inFence && line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (m) {
      if (cur.lines.join('\n').trim() || cur.heading) sections.push(cur)
      const heading = stripInline(m[2])
      cur = { heading, anchor: slugger.slug(heading), lines: [], charStart: offset }
    } else {
      cur.lines.push(raw)
    }
    offset += lineLen
  }
  if (cur.lines.join('\n').trim() || cur.heading) sections.push(cur)

  return sections
    .map((s) => ({ ...s, body: s.lines.join('\n').trim() }))
    .filter((s) => s.body || s.heading)
}

export function chunkContent(text, { markdown = false } = {}) {
  const src = String(text ?? '')
  if (!src.trim()) return []

  const raw = []

  if (markdown) {
    const sections = markdownSections(src)
    // Merge undersized sections forward so no tiny, score-distorting chunks emit.
    const merged = []
    let pending = null
    for (const s of sections) {
      const combined = pending
        ? { ...pending, body: `${pending.body}\n\n${s.heading ? `${s.heading}\n` : ''}${s.body}`.trim() }
        : { ...s, body: s.heading ? `${s.heading}\n${s.body}`.trim() : s.body }
      if (countWords(combined.body) < MIN_WORDS) { pending = combined; continue }
      merged.push(combined)
      pending = null
    }
    if (pending) {
      if (merged.length) {
        const last = merged[merged.length - 1]
        last.body = `${last.body}\n\n${pending.body}`.trim()
      } else {
        merged.push(pending)
      }
    }

    for (const s of merged) {
      if (countWords(s.body) <= MAX_WORDS) {
        raw.push({ heading: s.heading, anchor: s.anchor, content: s.body, wordCount: countWords(s.body), charStart: s.charStart })
      } else {
        for (const w of windowSplit(s.body, s.charStart)) {
          raw.push({ heading: s.heading, anchor: s.anchor, ...w })
        }
      }
    }
  } else {
    for (const w of windowSplit(src, 0)) {
      raw.push({ heading: null, anchor: null, ...w })
    }
  }

  return raw
    .filter((c) => c.content.trim())
    .slice(0, MAX_CHUNKS_PER_SOURCE)
    .map((c, i) => ({ ...c, position: i }))
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/chunkContent.test.js`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/chunkConfig.js src/lib/chunkContent.js src/lib/chunkContent.test.js
git commit -m "feat: chunkContent — structure-first hybrid chunking with enforced bounds"
```

---

### Task 3: `embed-entry` — batch + taskType (backward compatible)

**Files:**
- Modify: `supabase/functions/embed-entry/index.ts`

**Interfaces:**
- Consumes: existing `GEMINI_API_KEY`, auth pattern.
- Produces: the function accepts **either** `{ text, taskType? }` → `{ embedding }` (unchanged, so today's `embedEntryAsync`/`searchSemantic` keep working) **or** `{ texts: string[], taskType? }` → `{ embeddings: number[][] }`.

- [ ] **Step 1: Add batch + taskType support**

In `supabase/functions/embed-entry/index.ts`, replace the body-validation line and the Gemini call. Change:

```ts
  const body = await req.json().catch(() => null)
  if (!body?.text) return json({ error: 'missing text' }, 400)
```

to:

```ts
  const body = await req.json().catch(() => null)
  const texts: string[] | null = Array.isArray(body?.texts)
    ? body.texts
    : (body?.text ? [body.text] : null)
  if (!texts || texts.length === 0) return json({ error: 'missing text or texts' }, 400)
  // RETRIEVAL_DOCUMENT when storing, RETRIEVAL_QUERY when searching. Asymmetric
  // task types measurably improve retrieval; omitting them embeds docs and
  // queries identically.
  const taskType: string = body?.taskType ?? 'RETRIEVAL_DOCUMENT'
```

Then replace the whole `try { ... }` block that calls Gemini with:

```ts
  try {
    const embeddings: number[][] = []
    for (const text of texts) {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            content: { parts: [{ text }] },
            output_dimensionality: 1536,
            taskType,
          }),
        }
      )
      if (!res.ok) {
        const detail = await res.text()
        return json({ error: `gemini ${res.status}`, detail: detail.slice(0, 500) }, 502)
      }
      const data = await res.json()
      const embedding = data?.embedding?.values
      if (!embedding) return json({ error: 'no embedding returned' }, 502)
      embeddings.push(embedding)
    }
    // Single-text callers keep the original shape; batch callers get an array.
    return Array.isArray(body?.texts)
      ? json({ embeddings })
      : json({ embedding: embeddings[0] })
  } catch (e) {
    return json({ error: 'request failed', detail: String(e).slice(0, 200) }, 502)
  }
```

- [ ] **Step 2: Verify backward compatibility is preserved**

Run: `grep -c "embedding: embeddings\[0\]" supabase/functions/embed-entry/index.ts`
Expected: `1`

Run: `grep -c "taskType" supabase/functions/embed-entry/index.ts`
Expected: `3`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/embed-entry/index.ts
git commit -m "feat: embed-entry accepts batch texts and taskType, keeping single-text shape"
```

---

### Task 4: `contextualize.js` — batched Contextual Retrieval

**Files:**
- Create: `src/lib/contextualize.js`
- Test: `src/lib/contextualize.test.js`

**Interfaces:**
- Consumes: `callAI(supabase, { system, prompt, json })` from `src/lib/ai.js` (returns the model's text or `null`; never throws). `parseJSON` from the same module. `CONTEXTUALIZE_MIN_CHUNKS`, `CONTEXTUALIZE_BATCH_SIZE` from `chunkConfig.js`.
- Produces: `contextualizeChunks(supabase, { document, chunks }) → string[]` — one context string (or `''`) per chunk, same order/length as `chunks`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/contextualize.test.js`:

```js
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { contextualizeChunks } from './contextualize.js'

vi.mock('./ai.js', async () => {
  const actual = await vi.importActual('./ai.js')
  return { ...actual, callAI: vi.fn() }
})

const { callAI } = await import('./ai.js')
beforeEach(() => vi.clearAllMocks())

const chunk = (content) => ({ content })

describe('contextualizeChunks', () => {
  test('single-chunk sources are not contextualized and cost no AI call', async () => {
    const out = await contextualizeChunks({}, { document: 'doc', chunks: [chunk('only one')] })
    expect(out).toEqual([''])
    expect(callAI).not.toHaveBeenCalled()
  })

  test('sends ONE call per batch with the document, not one per chunk', async () => {
    callAI.mockResolvedValue(JSON.stringify({ contexts: ['ctx a', 'ctx b', 'ctx c'] }))
    const chunks = [chunk('a'), chunk('b'), chunk('c')]
    const out = await contextualizeChunks({}, { document: 'the whole document', chunks })
    expect(callAI).toHaveBeenCalledTimes(1)
    expect(out).toEqual(['ctx a', 'ctx b', 'ctx c'])
    const { prompt } = callAI.mock.calls[0][1]
    expect(prompt).toContain('the whole document')
  })

  test('returns empty strings (never throws) when the model fails', async () => {
    callAI.mockResolvedValue(null)
    const out = await contextualizeChunks({}, { document: 'doc', chunks: [chunk('a'), chunk('b')] })
    expect(out).toEqual(['', ''])
  })

  test('pads when the model returns too few contexts', async () => {
    callAI.mockResolvedValue(JSON.stringify({ contexts: ['only one'] }))
    const out = await contextualizeChunks({}, { document: 'doc', chunks: [chunk('a'), chunk('b')] })
    expect(out).toEqual(['only one', ''])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/contextualize.test.js`
Expected: FAIL — `Cannot find module './contextualize.js'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/contextualize.js`:

```js
import { callAI, parseJSON } from './ai.js'
import { CONTEXTUALIZE_MIN_CHUNKS, CONTEXTUALIZE_BATCH_SIZE } from './chunkConfig.js'

// Contextual Retrieval (Anthropic): prepending chunk-specific situating context
// before embedding/indexing cuts retrieval failures ~35%, ~49% combined with a
// lexical arm. The `ai` passthrough has no prompt caching, so we BATCH — the
// document is sent once per group of chunks, not once per chunk.

const SYSTEM = 'You situate excerpts within their source document to improve search retrieval. Reply with JSON only.'

function buildPrompt(document, chunks) {
  const numbered = chunks
    .map((c, i) => `<chunk index="${i}">\n${c.content}\n</chunk>`)
    .join('\n')
  return `<document>
${document}
</document>

Here are ${chunks.length} chunk(s) from the document above:
${numbered}

For EACH chunk, give a short succinct context (1-2 sentences, under 100 tokens) situating it within the overall document, to improve search retrieval of that chunk. Do not repeat the chunk. Do not add commentary.

Reply with JSON only: {"contexts": ["context for chunk 0", "context for chunk 1", ...]} with exactly ${chunks.length} entries in order.`
}

async function contextualizeBatch(supabase, document, batch) {
  const text = await callAI(supabase, {
    system: SYSTEM,
    prompt: buildPrompt(document, batch),
    json: true,
  })
  const parsed = parseJSON(text)
  const contexts = Array.isArray(parsed?.contexts) ? parsed.contexts : []
  // Never throw: a failed contextualizer degrades retrieval, it must not block indexing.
  return batch.map((_, i) => (typeof contexts[i] === 'string' ? contexts[i].trim() : ''))
}

export async function contextualizeChunks(supabase, { document, chunks }) {
  if (!chunks?.length) return []
  // A single chunk already IS its own context — contextualizing it is pure cost.
  if (chunks.length < CONTEXTUALIZE_MIN_CHUNKS) return chunks.map(() => '')

  const out = []
  for (let i = 0; i < chunks.length; i += CONTEXTUALIZE_BATCH_SIZE) {
    const batch = chunks.slice(i, i + CONTEXTUALIZE_BATCH_SIZE)
    out.push(...(await contextualizeBatch(supabase, document, batch)))
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/contextualize.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/contextualize.js src/lib/contextualize.test.js
git commit -m "feat: batched contextual retrieval — one call per document, not per chunk"
```

---

### Task 5: `chunkEntry.js` — orchestrate chunk → contextualize → embed → upsert

**Files:**
- Create: `src/lib/chunkEntry.js`
- Test: `src/lib/chunkEntry.test.js`

**Interfaces:**
- Consumes: `chunkContent(text, { markdown })` (Task 2); `contextualizeChunks(supabase, { document, chunks })` (Task 4); `embed-entry` batch shape `{ texts, taskType }` → `{ embeddings }` (Task 3); `NOTE_CHUNK_THRESHOLD`, `TASK_TYPE_DOCUMENT` from `chunkConfig.js`.
- Produces:
  - `sourcesFor(entry) → [{ source, text, markdown }]` — which sources of an entry are chunkable.
  - `hashText(text) → string`
  - `chunkEntryAsync(supabase, entry) → void` — fire-and-forget; never throws.

- [ ] **Step 1: Write the failing test**

Create `src/lib/chunkEntry.test.js`:

```js
import { describe, test, expect, vi } from 'vitest'
import { mockSupabase } from '../test/mockSupabase.js'
import { sourcesFor, hashText, chunkEntryAsync } from './chunkEntry.js'

describe('source_hash gate', () => {
  test('skips all AI/embedding work when the source text is unchanged', async () => {
    const note = 'short note'
    // existing row already carries this exact hash → nothing should be re-done
    const sb = mockSupabase({ data: [{ source_hash: hashText(note) }], error: null })
    sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
    sb.functions = { invoke: vi.fn() }

    await chunkEntryAsync(sb, { id: 'e1', note })

    // no embedding call, no insert — this gate is what stops re-embed churn/cost
    expect(sb.functions.invoke).not.toHaveBeenCalled()
    expect(sb._chain.insert).not.toHaveBeenCalled()
  })

  test('never throws when indexing fails — a save must not break', async () => {
    const sb = mockSupabase({ data: null, error: { message: 'boom' } })
    sb.auth = { getUser: async () => { throw new Error('no session') } }
    await expect(chunkEntryAsync(sb, { id: 'e1', note: 'x' })).resolves.toBeUndefined()
  })
})

describe('sourcesFor', () => {
  test('a short note is indexed as a single un-split source', () => {
    const out = sourcesFor({ id: 'e1', note: 'short note' })
    expect(out).toEqual([{ source: 'note', text: 'short note', markdown: false }])
  })

  test('a long note is split with markdown structure', () => {
    const long = 'x'.repeat(2000)
    const out = sourcesFor({ id: 'e1', note: long })
    expect(out).toEqual([{ source: 'note', text: long, markdown: true }])
  })

  test('full_text is always a plain-text source', () => {
    const out = sourcesFor({ id: 'e1', full_text: 'article body' })
    expect(out).toContainEqual({ source: 'full_text', text: 'article body', markdown: false })
  })

  test('takeaway is a markdown source', () => {
    const out = sourcesFor({ id: 'e1', takeaway: 'the insight' })
    expect(out).toContainEqual({ source: 'takeaway', text: 'the insight', markdown: true })
  })

  test('an entry with note, full_text and takeaway yields all three', () => {
    const out = sourcesFor({ id: 'e1', note: 'n', full_text: 'f', takeaway: 't' })
    expect(out.map((s) => s.source).sort()).toEqual(['full_text', 'note', 'takeaway'])
  })

  test('empty entry yields nothing', () => {
    expect(sourcesFor({ id: 'e1' })).toEqual([])
    expect(sourcesFor({ id: 'e1', note: '   ' })).toEqual([])
  })
})

describe('hashText', () => {
  test('is stable and differs on change', () => {
    expect(hashText('abc')).toBe(hashText('abc'))
    expect(hashText('abc')).not.toBe(hashText('abd'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chunkEntry.test.js`
Expected: FAIL — `Cannot find module './chunkEntry.js'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/chunkEntry.js`:

```js
import { chunkContent } from './chunkContent.js'
import { contextualizeChunks } from './contextualize.js'
import { NOTE_CHUNK_THRESHOLD, TASK_TYPE_DOCUMENT } from './chunkConfig.js'

// Replaces embedEntryAsync. Fire-and-forget: indexing must never break a save.

// Stable non-cryptographic hash (FNV-1a) — only needs to detect "text changed".
export function hashText(text) {
  let h = 0x811c9dc5
  const s = String(text ?? '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

// Which of an entry's fields are chunkable, and how to split each.
// NOTE_CHUNK_THRESHOLD decides SPLITTING, never whether a note is indexed:
// every non-empty source is indexed, short ones simply produce one chunk.
export function sourcesFor(entry) {
  const out = []
  if (entry?.full_text?.trim()) {
    out.push({ source: 'full_text', text: entry.full_text, markdown: false })
  }
  if (entry?.note?.trim()) {
    out.push({
      source: 'note',
      text: entry.note,
      markdown: entry.note.length > NOTE_CHUNK_THRESHOLD,
    })
  }
  if (entry?.takeaway?.trim()) {
    out.push({ source: 'takeaway', text: entry.takeaway, markdown: true })
  }
  return out
}

async function embedAll(supabase, texts) {
  const { data, error } = await supabase.functions.invoke('embed-entry', {
    body: { texts, taskType: TASK_TYPE_DOCUMENT },
  })
  if (error || !Array.isArray(data?.embeddings)) return null
  return data.embeddings
}

async function chunkSource(supabase, entry, userId, { source, text, markdown }) {
  const source_hash = hashText(text)

  // Skip work entirely when this source's text is unchanged.
  const { data: existing } = await supabase
    .from('content_chunks')
    .select('source_hash')
    .eq('entry_id', entry.id)
    .eq('source', source)
    .limit(1)
  if (existing?.[0]?.source_hash === source_hash) return

  const chunks = chunkContent(text, { markdown })
  if (!chunks.length) return

  const contexts = await contextualizeChunks(supabase, { document: text, chunks })
  // Embed context + content together; `content` alone is what users see.
  const embeddings = await embedAll(
    supabase,
    chunks.map((c, i) => (contexts[i] ? `${contexts[i]}\n\n${c.content}` : c.content))
  )
  if (!embeddings) return

  const rows = chunks.map((c, i) => ({
    user_id: userId,
    entry_id: entry.id,
    source,
    position: c.position,
    heading: c.heading ?? null,
    anchor: c.anchor ?? null,
    char_start: c.charStart ?? null,
    content: c.content,
    context: contexts[i] || null,
    word_count: c.wordCount,
    source_hash,
    embedding: embeddings[i],
  }))

  await supabase.from('content_chunks').delete().eq('entry_id', entry.id).eq('source', source)
  await supabase.from('content_chunks').insert(rows)
}

export async function chunkEntryAsync(supabase, entry) {
  try {
    const sources = sourcesFor(entry)
    if (!sources.length) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    for (const s of sources) {
      await chunkSource(supabase, entry, user.id, s)
    }
  } catch {
    // Indexing is best-effort; a failure must never surface to the user.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chunkEntry.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/chunkEntry.js src/lib/chunkEntry.test.js
git commit -m "feat: chunkEntry — chunk, contextualize, embed and upsert an entry's sources"
```

---

### Task 6: `retrieval.js` — the tool-shaped search + related with MMR

**Files:**
- Create: `src/lib/db/retrieval.js`
- Test: `src/lib/db/retrieval.test.js`

**Interfaces:**
- Consumes: RPC `search_chunks(query_embedding, query_text, match_count, rrf_k, trgm_threshold, use_trigram)` (Task 1); `embed-entry` `{ text, taskType }` → `{ embedding }` (Task 3); config from `chunkConfig.js`.
- Produces:
  - `shouldUseTrigram(query) → boolean`
  - `mmrSelect(candidates, { k, lambda }) → candidates[]` — `candidates` are `{ id, score, entryId, topicId }`; diversity by `topicId`.
  - `searchChunks(supabase, { query, topK, useTrigram }) → [{ chunkId, entryId, score, content, heading, anchor, charStart }]` — **stateless, repeatably callable** (the agent contract).
  - `relatedTo(supabase, { entryId, topK }) → [{ entryId, score, content, heading, anchor }]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/db/retrieval.test.js`:

```js
import { describe, test, expect } from 'vitest'
import { shouldUseTrigram, mmrSelect } from './retrieval.js'

describe('shouldUseTrigram', () => {
  test('engages for short queries (where typos matter)', () => {
    expect(shouldUseTrigram('adverze selection')).toBe(true)
    expect(shouldUseTrigram('vwap')).toBe(true)
  })

  test('does not engage for long queries (trigram is noisy on prose)', () => {
    expect(shouldUseTrigram('why do market makers lose money to informed traders over time')).toBe(false)
  })

  test('does not engage on empty input', () => {
    expect(shouldUseTrigram('')).toBe(false)
    expect(shouldUseTrigram('   ')).toBe(false)
  })
})

describe('mmrSelect', () => {
  test('prefers high score but drops same-topic redundancy', () => {
    const candidates = [
      { id: 'a', score: 0.9, entryId: 'e1', topicId: 't1' },
      { id: 'b', score: 0.89, entryId: 'e2', topicId: 't1' }, // same topic as the winner
      { id: 'c', score: 0.7, entryId: 'e3', topicId: 't2' },  // different topic
    ]
    const out = mmrSelect(candidates, { k: 2, lambda: 0.5 })
    expect(out[0].id).toBe('a')
    expect(out[1].id).toBe('c') // diversity beats the marginally-higher same-topic hit
  })

  test('returns everything when k exceeds the candidate count', () => {
    const candidates = [{ id: 'a', score: 1, entryId: 'e1', topicId: 't1' }]
    expect(mmrSelect(candidates, { k: 5, lambda: 0.5 })).toHaveLength(1)
  })

  test('handles an empty candidate list', () => {
    expect(mmrSelect([], { k: 3, lambda: 0.5 })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/retrieval.test.js`
Expected: FAIL — `Cannot find module './retrieval.js'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/db/retrieval.js`:

```js
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
  const bestPerEntry = new Map()
  for (const h of hydrated) {
    const prev = bestPerEntry.get(h.entryId)
    if (!prev || h.score > prev.score) bestPerEntry.set(h.entryId, h)
  }
  const rolled = [...bestPerEntry.values()]

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/retrieval.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/retrieval.js src/lib/db/retrieval.test.js
git commit -m "feat: tool-shaped hybrid searchChunks + relatedTo with MMR diversity"
```

---

### Task 7: `scripts/rechunk.js` — backfill / re-index on demand

**Files:**
- Create: `scripts/rechunk.js`

**Interfaces:**
- Consumes: `chunkContent`, `sourcesFor`, `hashText` (Tasks 2/5); `chunkConfig.js`. Follows the env pattern of the existing `scripts/backfill-embeddings.js` (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `VITE_SUPABASE_URL`), plus `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` for contextualization.
- Produces: `node scripts/rechunk.js [entryId]` — re-chunks the whole library (or one entry). Resumable via `source_hash`; batches embeddings.

- [ ] **Step 1: Write the script**

Create `scripts/rechunk.js`:

```js
#!/usr/bin/env node
// Re-chunk + re-embed the library. Chunks are DERIVED data — run this after
// changing any sizing knob in src/lib/chunkConfig.js.
//   node scripts/rechunk.js            # everything missing/changed
//   node scripts/rechunk.js <entryId>  # one entry
//
// Embeddings are batched per chunk-group (not a 500ms serial drip, which would
// take hours over tens of thousands of chunks).

import { createClient } from '@supabase/supabase-js'
import { chunkContent } from '../src/lib/chunkContent.js'
import { sourcesFor, hashText } from '../src/lib/chunkEntry.js'
import {
  CONTEXTUALIZE_MIN_CHUNKS, CONTEXTUALIZE_BATCH_SIZE, TASK_TYPE_DOCUMENT, EMBED_DIMS,
} from '../src/lib/chunkConfig.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const AI_BASE_URL = process.env.AI_BASE_URL
const AI_API_KEY = process.env.AI_API_KEY
const AI_MODEL = process.env.AI_MODEL

for (const [k, v] of Object.entries({ VITE_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, GEMINI_API_KEY })) {
  if (!v) { console.error(`Set ${k}`); process.exit(1) }
}
const canContextualize = Boolean(AI_BASE_URL && AI_API_KEY && AI_MODEL)
if (!canContextualize) {
  console.warn('AI_BASE_URL/AI_API_KEY/AI_MODEL not set — indexing WITHOUT contextual retrieval (lower quality).')
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function embedBatch(texts) {
  const out = []
  for (const text of texts) {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          output_dimensionality: EMBED_DIMS,
          taskType: TASK_TYPE_DOCUMENT,
        }),
      }
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = await res.json()
    out.push(data.embedding.values)
  }
  return out
}

async function contextualize(document, chunks) {
  if (!canContextualize || chunks.length < CONTEXTUALIZE_MIN_CHUNKS) return chunks.map(() => '')
  const out = []
  for (let i = 0; i < chunks.length; i += CONTEXTUALIZE_BATCH_SIZE) {
    const batch = chunks.slice(i, i + CONTEXTUALIZE_BATCH_SIZE)
    const numbered = batch.map((c, j) => `<chunk index="${j}">\n${c.content}\n</chunk>`).join('\n')
    const prompt = `<document>\n${document}\n</document>\n\nHere are ${batch.length} chunk(s) from the document above:\n${numbered}\n\nFor EACH chunk, give a short succinct context (1-2 sentences, under 100 tokens) situating it within the overall document, to improve search retrieval of that chunk. Do not repeat the chunk. Do not add commentary.\n\nReply with JSON only: {"contexts": ["context for chunk 0", ...]} with exactly ${batch.length} entries in order.`
    try {
      const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AI_MODEL,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You situate excerpts within their source document to improve search retrieval. Reply with JSON only.' },
            { role: 'user', content: prompt },
          ],
        }),
      })
      const data = await res.json()
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
      const contexts = Array.isArray(parsed.contexts) ? parsed.contexts : []
      out.push(...batch.map((_, j) => (typeof contexts[j] === 'string' ? contexts[j].trim() : '')))
    } catch {
      out.push(...batch.map(() => ''))
    }
  }
  return out
}

async function processEntry(entry) {
  let written = 0
  for (const { source, text, markdown } of sourcesFor(entry)) {
    const source_hash = hashText(text)
    const { data: existing } = await supabase
      .from('content_chunks').select('source_hash')
      .eq('entry_id', entry.id).eq('source', source).limit(1)
    if (existing?.[0]?.source_hash === source_hash) continue

    const chunks = chunkContent(text, { markdown })
    if (!chunks.length) continue

    const contexts = await contextualize(text, chunks)
    const embeddings = await embedBatch(
      chunks.map((c, i) => (contexts[i] ? `${contexts[i]}\n\n${c.content}` : c.content))
    )

    await supabase.from('content_chunks').delete().eq('entry_id', entry.id).eq('source', source)
    const { error } = await supabase.from('content_chunks').insert(
      chunks.map((c, i) => ({
        user_id: entry.user_id,
        entry_id: entry.id,
        source,
        position: c.position,
        heading: c.heading ?? null,
        anchor: c.anchor ?? null,
        char_start: c.charStart ?? null,
        content: c.content,
        context: contexts[i] || null,
        word_count: c.wordCount,
        source_hash,
        embedding: embeddings[i],
      }))
    )
    if (error) throw new Error(error.message)
    written += chunks.length
  }
  return written
}

async function main() {
  const only = process.argv[2]
  let q = supabase.from('entries').select('id, user_id, note, full_text, takeaway').is('deleted_at', null)
  if (only) q = q.eq('id', only)
  const { data: entries, error } = await q
  if (error) { console.error('Fetch failed:', error.message); process.exit(1) }

  console.log(`${entries.length} entries to consider`)
  let done = 0, chunks = 0, failed = 0
  for (const entry of entries) {
    try {
      chunks += await processEntry(entry)
      done++
    } catch (e) {
      failed++
      console.error(`\nFailed ${entry.id}: ${e.message}`)
    }
    process.stdout.write(`\r${done}/${entries.length} entries, ${chunks} chunks written, ${failed} failed`)
  }
  console.log(`\nDone. ${done} entries, ${chunks} chunks, ${failed} failed.`)
}

main()
```

- [ ] **Step 2: Verify it parses and shows usage without env**

Run: `node --check scripts/rechunk.js && echo "SYNTAX OK"`
Expected: `SYNTAX OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/rechunk.js
git commit -m "feat: rechunk script — batched re-index of the library, resumable via source_hash"
```

---

### Task 8: `retrievalEval.js` — measure, don't argue

**Files:**
- Create: `src/lib/retrievalEval.js`
- Create: `src/lib/retrievalEval.fixture.json`
- Test: `src/lib/retrievalEval.test.js`

**Interfaces:**
- Consumes: `searchChunks(supabase, { query, topK })` (Task 6).
- Produces: `scoreRun(results) → { failureRate, recallAt5, mrr, perQuery }` where `results` is `[{ query, retrieved: entryId[], expected: entryId[] }]`; `runEval(supabase, fixture) → { failureRate, recallAt5, mrr, perQuery }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/retrievalEval.test.js`:

```js
import { describe, test, expect } from 'vitest'
import { scoreRun } from './retrievalEval.js'

describe('scoreRun', () => {
  test('counts a query as failed when no expected entry is retrieved', () => {
    const out = scoreRun([{ query: 'q1', retrieved: ['x', 'y'], expected: ['a'] }])
    expect(out.failureRate).toBe(1)
    expect(out.recallAt5).toBe(0)
    expect(out.mrr).toBe(0)
  })

  test('rewards an expected hit and reports its reciprocal rank', () => {
    const out = scoreRun([{ query: 'q1', retrieved: ['x', 'a', 'y'], expected: ['a'] }])
    expect(out.failureRate).toBe(0)
    expect(out.recallAt5).toBe(1)
    expect(out.mrr).toBeCloseTo(0.5) // rank 2 → 1/2
  })

  test('averages across queries', () => {
    const out = scoreRun([
      { query: 'q1', retrieved: ['a'], expected: ['a'] },
      { query: 'q2', retrieved: ['z'], expected: ['b'] },
    ])
    expect(out.failureRate).toBeCloseTo(0.5)
    expect(out.mrr).toBeCloseTo(0.5)
  })

  test('handles an empty run', () => {
    expect(scoreRun([])).toMatchObject({ failureRate: 0, recallAt5: 0, mrr: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/retrievalEval.test.js`
Expected: FAIL — `Cannot find module './retrievalEval.js'`

- [ ] **Step 3: Write the fixture**

Create `src/lib/retrievalEval.fixture.json` (starter — replace the entry ids with real ones from your library; Anthropic's guidance is ~20 real queries):

```json
{
  "note": "Replace expected[] with real entry ids from your library. ~20 queries representing real usage. Run before and after a chunkConfig change to compare.",
  "queries": [
    { "query": "why do market makers lose money to informed traders", "expected": [] },
    { "query": "adverze selection", "expected": [] },
    { "query": "what sets the width of the bid-ask spread", "expected": [] },
    { "query": "write-ahead logging", "expected": [] },
    { "query": "price-time priority", "expected": [] }
  ]
}
```

- [ ] **Step 4: Write the implementation**

Create `src/lib/retrievalEval.js`:

```js
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/retrievalEval.test.js`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the whole new suite and commit**

Run: `npx vitest run src/lib/chunkContent.test.js src/lib/contextualize.test.js src/lib/chunkEntry.test.js src/lib/db/retrieval.test.js src/lib/retrievalEval.test.js`
Expected: PASS (all)

```bash
git add src/lib/retrievalEval.js src/lib/retrievalEval.fixture.json src/lib/retrievalEval.test.js
git commit -m "feat: retrieval eval harness measuring failure rate, recall@5 and MRR"
```

---

## Post-plan manual steps (user runs these)

1. `npx supabase db push` — applies `0043_content_chunks.sql` (creates `pg_trgm`, the table, three indexes, `search_chunks`).
2. `npx supabase functions deploy embed-entry --no-verify-jwt` — ships batch + `taskType`. **Backward compatible**, so today's `searchSemantic`/`embedEntryAsync` keep working.
3. Confirm `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` are set in Supabase secrets (contextualization degrades gracefully to off without them, at lower retrieval quality).
4. `node scripts/rechunk.js` — backfill. Verify every non-empty entry has ≥1 chunk before Plan 2 drops the old table.
5. Fill real entry ids into `src/lib/retrievalEval.fixture.json` and record a baseline.

## Deferred to Plan 2 (do NOT build here)

- Wiring `chunkEntryAsync` into `App.jsx` in place of `embedEntryAsync`.
- Repointing `searchSemantic` → `searchChunks`.
- The related-entries footer UI and passage-mode search results.
- Dropping `entry_embeddings`, its index, and `match_entries` (only after step 4 is verified).
