# Chunk Retrieval Consumers Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the (already built and deployed) chunk retrieval engine into the app — passage-powered search, jump-to-passage, a related-entries footer — then retire the legacy whole-entry embedding path.

**Architecture:** `searchSemantic` is repointed at `searchChunks` through a roll-up adapter that returns entry-shaped results carrying their best matching passage, with a **fallback to the legacy `match_entries` path while `content_chunks` is empty** so search never breaks before the backfill runs. `embedEntryAsync` is replaced by `chunkEntryAsync` at all 8 App.jsx call sites. A `RelatedEntries` footer fetches **on demand** (never per-card on render). The legacy table/RPC is dropped only in the final task, after the backfill is verified.

**Tech Stack:** React 18, Supabase (pgvector + pg_trgm), Vite, Vitest + @testing-library/react.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-chunk-retrieval-design.md` (sections "UI consumers" and "Migration path").
- Plan 1 shipped the engine: `content_chunks` + `search_chunks` (migration `0043`, **already applied to the linked project**), `src/lib/db/retrieval.js`, `src/lib/chunkEntry.js`. Do not re-implement them.
- **`searchChunks` returns an RRF score (~0.01–0.05), NOT a 0–1 similarity.** Never render it as a percentage. Show the matching passage instead.
- **Nothing may lose searchability at any point.** Until Task 5, the legacy `entry_embeddings`/`match_entries` path stays intact and is used as a fallback.
- **Related-entries must never fire per-card on render** — an entry list would issue N RPC calls. Fetch on demand only.
- The machine-written `context` column is never displayed; only `content`.
- Tests: `npx vitest run <path>`; vitest takes ~30s to boot. DB helpers use `src/test/mockSupabase.js`.
- Commit style: NO `Co-Authored-By: Claude` or `Claude-Session:` trailer. Conventional prefixes.
- **Verify `git rev-parse --abbrev-ref HEAD` before any migration or build** — background tooling in this repo has switched branches mid-session, which makes `supabase db push` silently no-op.
- Do NOT run `supabase db push`, deploy functions, or run `scripts/rechunk.js` — those are the user's manual steps.

## Prerequisite the user runs (not a task)

`node scripts/rechunk.js` populates `content_chunks`. Until it runs the table is empty and the Task-1 fallback keeps legacy search working. Task 5 must NOT be executed until the backfill is verified.

---

### Task 1: Roll-up adapter + repoint `searchSemantic` (with legacy fallback)

**Files:**
- Modify: `src/lib/db/retrieval.js` (add `searchChunksAsEntries`)
- Modify: `src/lib/db/entries.js` (`searchSemantic` → chunks, legacy retained as fallback)
- Test: `src/lib/db/retrieval.test.js` (append)

**Interfaces:**
- Consumes: `searchChunks(supabase, { query, topK })` → `[{ chunkId, entryId, score, content, heading, anchor, charStart }]`.
- Produces: `searchChunksAsEntries(supabase, query, { topK }) → entry[]` where each entry has `tags`, `topicName`, `passage`, `passageHeading`, `passageAnchor`, and `similarity: null` (RRF is not a similarity). `searchSemantic` keeps its existing signature so `ExploreView` needs no change to call it.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/db/retrieval.test.js`:

```js
import { bestPerEntry } from './retrieval.js'

describe('bestPerEntry', () => {
  test('keeps the first (highest-ranked) hit per entry', () => {
    const hits = [
      { chunkId: 'c1', entryId: 'e1', score: 0.05, content: 'best for e1' },
      { chunkId: 'c2', entryId: 'e1', score: 0.03, content: 'worse for e1' },
      { chunkId: 'c3', entryId: 'e2', score: 0.04, content: 'best for e2' },
    ]
    const out = bestPerEntry(hits)
    expect(out.map((h) => h.chunkId)).toEqual(['c1', 'c3'])
    expect(out[0].content).toBe('best for e1')
  })

  test('preserves incoming rank order and handles an empty list', () => {
    expect(bestPerEntry([])).toEqual([])
    const hits = [
      { chunkId: 'a', entryId: 'e9', score: 0.9 },
      { chunkId: 'b', entryId: 'e1', score: 0.1 },
    ]
    expect(bestPerEntry(hits).map((h) => h.entryId)).toEqual(['e9', 'e1'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/retrieval.test.js`
Expected: FAIL — `bestPerEntry is not a function`

- [ ] **Step 3: Add the adapter to `src/lib/db/retrieval.js`**

Append to the end of the file:

```js
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
```

- [ ] **Step 4: Repoint `searchSemantic` in `src/lib/db/entries.js`**

Add this import at the top of the file (after the existing imports):

```js
import { searchChunksAsEntries } from './retrieval.js'
```

Rename the existing `export async function searchSemantic(supabase, query) {` to:

```js
// Legacy whole-entry path. Retained as a fallback until content_chunks is
// backfilled; removed together with entry_embeddings in migration 0044.
async function legacySearchSemantic(supabase, query) {
```

Then add the new exported wrapper immediately after that function's closing brace:

```js
export async function searchSemantic(supabase, query) {
  const viaChunks = await searchChunksAsEntries(supabase, query)
  if (viaChunks.length) return viaChunks
  // content_chunks not backfilled yet (or genuinely no match) — fall back so
  // search never regresses mid-migration.
  return legacySearchSemantic(supabase, query)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/db/retrieval.test.js src/lib/db/entries.test.js`
Expected: PASS (existing tests plus the 2 new ones)

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/retrieval.js src/lib/db/entries.js src/lib/db/retrieval.test.js
git commit -m "feat: repoint searchSemantic at chunk retrieval with legacy fallback"
```

---

### Task 2: ExploreView — show the matching passage, jump to it

**Files:**
- Modify: `src/components/ExploreView.jsx`
- Modify: `src/styles.css` (append)
- Test: `src/components/ExploreView.test.jsx` (create if absent, else append)

**Interfaces:**
- Consumes: entries from Task 1 carrying `passage`, `passageHeading`, `passageAnchor`, `similarity: null`.
- Produces: `onSelectEntry(entry)` is still called with the entry; the entry object now carries `passageAnchor` so the caller can scroll to it.

- [ ] **Step 1: Write the failing test**

Create `src/components/ExploreView.test.jsx` (if it already exists, append these tests inside it):

```jsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import ExploreView from './ExploreView.jsx'

vi.mock('../lib/db/entries.js', () => ({
  searchEntries: vi.fn(async () => []),
  searchSemantic: vi.fn(async () => [{
    id: 'e1', title: 'Trading and Exchanges', note: '', status: 'active', topic_id: 't1',
    tags: [], topicName: 'Quant', similarity: null,
    passage: 'the spread compensates the maker for adverse selection',
    passageHeading: 'Adverse selection', passageAnchor: 'adverse-selection',
  }]),
  listReadingQueue: vi.fn(async () => []),
}))

beforeEach(() => vi.clearAllMocks())

test('semantic results render the matching passage, not a percentage', async () => {
  render(<ExploreView supabase={{}} topics={[]} onSelectEntry={vi.fn()} onOrderedIds={vi.fn()} />)
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'adverse' } })
  fireEvent.click(await screen.findByRole('button', { name: /semantic/i }))
  expect(await screen.findByText(/spread compensates the maker/i)).toBeTruthy()
  // RRF score must never be shown as a similarity percentage
  expect(screen.queryByText(/^\d+%$/)).toBeNull()
})

test('clicking a passage result passes the entry (with its anchor) up', async () => {
  const onSelect = vi.fn()
  render(<ExploreView supabase={{}} topics={[]} onSelectEntry={onSelect} onOrderedIds={vi.fn()} />)
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'adverse' } })
  fireEvent.click(await screen.findByRole('button', { name: /semantic/i }))
  fireEvent.click(await screen.findByText('Trading and Exchanges'))
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'e1', passageAnchor: 'adverse-selection' }),
  ))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ExploreView.test.jsx`
Expected: FAIL — passage text not rendered

- [ ] **Step 3: Render the passage in `src/components/ExploreView.jsx`**

In the `EntryRow` component, replace the similarity chip block:

```jsx
        {showSimilarity && entry.similarity != null && (
          <span className="explore-similarity">{Math.round(entry.similarity * 100)}%</span>
        )}
```

with:

```jsx
        {entry.similarity != null && (
          <span className="explore-similarity">{Math.round(entry.similarity * 100)}%</span>
        )}
```

Then, immediately after the closing `</div>` of `explore-row-main` and before `explore-row-meta`, add the passage block:

```jsx
      {entry.passage && (
        <p className="explore-passage">
          {entry.passageHeading && <span className="explore-passage-heading">{entry.passageHeading} · </span>}
          {entry.passage.length > 220 ? `${entry.passage.slice(0, 220).trimEnd()}…` : entry.passage}
        </p>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ExploreView.test.jsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Append styles to `src/styles.css`**

```css
/* ── Explore: matching passage from chunk retrieval ── */
.explore-passage {
  margin: 4px 0 0 24px;
  font-size: var(--text-sm);
  color: var(--text-secondary, var(--muted));
  line-height: 1.5;
  border-left: 2px solid var(--border);
  padding-left: 10px;
}
.explore-passage-heading { color: var(--accent); font-weight: 500; }
```

- [ ] **Step 6: Re-run the test and commit**

Run: `npx vitest run src/components/ExploreView.test.jsx`
Expected: PASS (2 tests)

```bash
git add src/components/ExploreView.jsx src/components/ExploreView.test.jsx src/styles.css
git commit -m "feat: Explore shows the matching passage for chunk-retrieval hits"
```

---

### Task 3: Swap `embedEntryAsync` → `chunkEntryAsync` in App.jsx

**Files:**
- Modify: `src/App.jsx` (import + 8 call sites)

**Interfaces:**
- Consumes: `chunkEntryAsync(supabase, entry)` from `src/lib/chunkEntry.js` — same fire-and-forget contract as `embedEntryAsync` (never throws), so this is a drop-in name swap.

- [ ] **Step 1: Replace the import**

In `src/App.jsx` line 17, change:

```jsx
import { embedEntryAsync } from './lib/embedEntry.js'
```

to:

```jsx
import { chunkEntryAsync } from './lib/chunkEntry.js'
```

- [ ] **Step 2: Replace all 8 call sites**

Run this exact command from `C:\Users\liang\Documents\medialog`:

```bash
sed -i 's/embedEntryAsync(/chunkEntryAsync(/g' src/App.jsx
```

- [ ] **Step 3: Verify no references remain**

Run: `grep -c 'embedEntryAsync' src/App.jsx`
Expected: `0`

Run: `grep -c 'chunkEntryAsync' src/App.jsx`
Expected: `9` (1 import + 8 call sites)

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: `✓ built` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: index entries via chunkEntryAsync instead of whole-entry embedding"
```

---

### Task 4: `RelatedEntries` footer (on-demand) wired into EntryCard

**Files:**
- Create: `src/components/RelatedEntries.jsx`
- Test: `src/components/RelatedEntries.test.jsx`
- Modify: `src/components/EntryCard.jsx`
- Modify: `src/styles.css` (append)

**Interfaces:**
- Consumes: `relatedTo(supabase, { entryId, topK })` from `src/lib/db/retrieval.js`, returning MMR-selected items with `entryId`, `content`, `heading`, `score`.
- Produces: `<RelatedEntries supabase entryId onOpen />` — renders a "related" button; fetches ONLY when clicked.

- [ ] **Step 1: Write the failing test**

Create `src/components/RelatedEntries.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import RelatedEntries from './RelatedEntries.jsx'

vi.mock('../lib/db/retrieval.js', () => ({
  relatedTo: vi.fn(async () => [
    { entryId: 'e2', content: 'market makers quote both sides', heading: 'Market making', score: 0.04 },
  ]),
}))

beforeEach(() => vi.clearAllMocks())

test('does not query until the user asks for related items', async () => {
  const { relatedTo } = await import('../lib/db/retrieval.js')
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  // critical: rendering a list of cards must not fire N queries
  expect(relatedTo).not.toHaveBeenCalled()
})

test('fetches and lists related passages when clicked', async () => {
  const { relatedTo } = await import('../lib/db/retrieval.js')
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /related/i }))
  await waitFor(() => expect(relatedTo).toHaveBeenCalledWith(
    expect.anything(), expect.objectContaining({ entryId: 'e1' }),
  ))
  expect(await screen.findByText(/market makers quote both sides/i)).toBeTruthy()
})

test('opens the related entry when a result is clicked', async () => {
  const onOpen = vi.fn()
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={onOpen} />)
  fireEvent.click(screen.getByRole('button', { name: /related/i }))
  fireEvent.click(await screen.findByText(/market makers quote both sides/i))
  expect(onOpen).toHaveBeenCalledWith('e2')
})

test('reports when there is nothing related', async () => {
  const { relatedTo } = await import('../lib/db/retrieval.js')
  relatedTo.mockResolvedValueOnce([])
  render(<RelatedEntries supabase={{}} entryId="e1" onOpen={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /related/i }))
  expect(await screen.findByText(/nothing related/i)).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/RelatedEntries.test.jsx`
Expected: FAIL — `Cannot find module './RelatedEntries.jsx'`

- [ ] **Step 3: Write the component**

Create `src/components/RelatedEntries.jsx`:

```jsx
import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { relatedTo } from '../lib/db/retrieval.js'

// On-demand only. Entry cards render in lists, so fetching on mount would fire
// one RPC per visible card; the user asks for related items explicitly.
export default function RelatedEntries({ supabase, entryId, onOpen }) {
  const [items, setItems] = useState(null) // null = not fetched yet
  const [busy, setBusy] = useState(false)

  async function load(e) {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      setItems(await relatedTo(supabase, { entryId, topK: 5 }))
    } catch {
      setItems([])
    }
    setBusy(false)
  }

  return (
    <div className="rel-wrap" onClick={(e) => e.stopPropagation()}>
      {items === null ? (
        <button className="rel-btn" onClick={load} disabled={busy}>
          <Link2 size={12} /> {busy ? 'finding…' : 'related'}
        </button>
      ) : items.length === 0 ? (
        <p className="rel-empty muted">nothing related yet</p>
      ) : (
        <ul className="rel-list">
          {items.map((it) => (
            <li key={it.entryId}>
              <button className="rel-item" onClick={() => onOpen?.(it.entryId)}>
                {it.heading && <span className="rel-heading">{it.heading} · </span>}
                {it.content.length > 160 ? `${it.content.slice(0, 160).trimEnd()}…` : it.content}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/RelatedEntries.test.jsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire into `src/components/EntryCard.jsx`**

Add this import after the `MarkdownOutline` import (line 7):

```jsx
import RelatedEntries from './RelatedEntries.jsx'
```

Then, immediately after the note-render block's closing `)}` (the block that ends with the `card-add-note-btn` button's closing `)}`), add:

```jsx
      {!editing && onOpenRelated && (
        <RelatedEntries supabase={supabase} entryId={entry.id} onOpen={onOpenRelated} />
      )}
```

Add `onOpenRelated` to the `EntryCard` props destructuring (alongside `onPreview`).

- [ ] **Step 6: Append styles to `src/styles.css`**

```css
/* ── Related entries footer ── */
.rel-wrap { margin-top: 10px; }
.rel-btn {
  display: inline-flex; align-items: center; gap: 5px;
  background: none; border: 1px solid var(--border); border-radius: 6px;
  padding: 3px 9px; font-size: var(--text-xs); color: var(--muted); cursor: pointer;
}
.rel-btn:hover { color: var(--accent); border-color: var(--accent); }
.rel-empty { font-size: var(--text-xs); margin: 6px 0 0; }
.rel-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.rel-item {
  text-align: left; background: none; border: none; cursor: pointer;
  font-size: var(--text-sm); color: var(--muted); line-height: 1.45;
  border-left: 2px solid var(--accent); padding: 2px 0 2px 10px; width: 100%;
}
.rel-item:hover { color: var(--text); background: var(--surface-2); }
.rel-heading { color: var(--accent); font-weight: 500; }
```

- [ ] **Step 7: Verify build and commit**

Run: `npm run build`
Expected: `✓ built`

```bash
git add src/components/RelatedEntries.jsx src/components/RelatedEntries.test.jsx src/components/EntryCard.jsx src/styles.css
git commit -m "feat: on-demand related-entries footer powered by chunk retrieval"
```

---

### Task 5: Retire the legacy embedding path

> **DO NOT EXECUTE until the user confirms `node scripts/rechunk.js` has run and every non-empty entry has ≥1 row in `content_chunks`.** This task removes the fallback; running it early breaks semantic search.

**Files:**
- Create: `supabase/migrations/0044_drop_entry_embeddings.sql`
- Modify: `src/lib/db/entries.js` (remove `legacySearchSemantic` + fallback)
- Delete: `src/lib/embedEntry.js`

**Interfaces:**
- Produces: `searchSemantic` becomes a thin alias of `searchChunksAsEntries`; `entry_embeddings` and `match_entries` no longer exist.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0044_drop_entry_embeddings.sql`:

```sql
-- Retire the legacy whole-entry embedding path. content_chunks (0043) has
-- superseded it; run scripts/rechunk.js and verify every non-empty entry has
-- at least one chunk BEFORE applying this.

drop function if exists match_entries(vector, float, int);
drop table if exists entry_embeddings;
```

- [ ] **Step 2: Simplify `searchSemantic` in `src/lib/db/entries.js`**

Delete the entire `legacySearchSemantic` function, and replace the `searchSemantic` wrapper with:

```js
export async function searchSemantic(supabase, query) {
  return searchChunksAsEntries(supabase, query)
}
```

- [ ] **Step 3: Delete the dead module**

```bash
git rm src/lib/embedEntry.js
```

- [ ] **Step 4: Verify nothing still references the legacy path**

Run: `grep -rn "embedEntryAsync\|match_entries\|entry_embeddings" src/ | grep -v node_modules`
Expected: no output (empty).

- [ ] **Step 5: Verify tests and build**

Run: `npx vitest run src/lib/db/ src/components/ExploreView.test.jsx src/components/RelatedEntries.test.jsx`
Expected: PASS

Run: `npm run build`
Expected: `✓ built`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0044_drop_entry_embeddings.sql src/lib/db/entries.js
git commit -m "feat: retire legacy entry_embeddings path in favour of chunk retrieval"
```

---

## Post-plan manual steps (user runs these)

1. `node scripts/rechunk.js` — backfill `content_chunks` (needs `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and optionally `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` for contextualization).
2. Verify every non-empty, non-deleted entry has ≥1 chunk.
3. Only then: run Task 5, and `npx supabase db push` to apply `0044`.
4. Fill real entry ids into `src/lib/retrievalEval.fixture.json` and record a baseline with the eval harness.

## Deferred (not in this plan)

- **Precise scroll-into-reader for `char_start`** passages (plain-text/`full_text` chunks). Task 2 surfaces the passage text and, for markdown chunks, the `passageAnchor`; scrolling the reader to a character offset and highlighting is follow-up work.
- Deep-topic takeaway related-footer (the spec mentions it; EntryCard covers the main case first).
- Reranking (the measured −49% → −67% step), and true BM25 via `pg_search`.
