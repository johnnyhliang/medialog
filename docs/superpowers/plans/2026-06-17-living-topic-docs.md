# Living Topic Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each topic a master markdown document above its entry list, with stable `[[entry:UUID]]` embeds (typed via `[[` autocomplete) that render as inline chips with fast hover/long-press previews and click-to-jump, plus scoped fuzzy search.

**Architecture:** A `master_doc` column on `topics` holds the doc. Embed tokens are expanded into `entry:`-scheme markdown links so the existing `MarkdownView` `components.a` interceptor renders them as `<EntryEmbed>` — no custom remark plugin. Entry titles are always computed/stored from the note. A client-side in-memory entry index powers both the `[[` CodeMirror autocomplete and fuzzy search; nothing hits the network per keystroke.

**Tech Stack:** React 18, CodeMirror 6 (`@codemirror/autocomplete`), react-markdown 10, `rehype-slug`, Supabase, Vitest + React Testing Library.

## Prerequisite

This plan depends on the **file-preview plan** (`2026-06-17-file-preview.md`) being executed first — it creates `src/lib/classifyUrl.js` (imported by Tasks 8 & 9) and establishes the `onPreview`/file-chip path in `MarkdownView` and the `pairKeymap` in `NoteEditor` that Tasks 9 & 10 build on. If file-preview is **not** done first: create `src/lib/classifyUrl.js` (per file-preview Task 1) before starting Task 8, and in Task 9 omit the `onPreview`/file-chip branch. `src/lib/youtube.js` (`getYouTubeId`, `getYouTubeThumbnail`, `isYouTubeUrl`) already exists.

## Global Constraints

- Node ESM — `export`/`import` only, no `require`
- Tests colocated: `src/lib/foo.test.js` beside `src/lib/foo.js`
- Run tests: `npm test -- --run`
- Warm off-white palette: use existing CSS vars (`--bg`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--accent`, `--accent-weak`, `--text`, `--muted`, `--radius`)
- All styles in `src/styles.css` — no CSS-in-JS
- Store raw title text — never slugs/dashes in the DB
- Embed reference format: `[[entry:UUID]]` or `[[entry:UUID|label]]`
- Flat topics — no nesting

---

### Task 1: Migration + updateTopicDoc

**Files:**
- Create: `supabase/migrations/0007_master_doc.sql`
- Modify: `src/lib/db/topics.js`
- Test: `src/lib/db/topics.test.js`

**Interfaces:**
- Produces: `updateTopicDoc(supabase, topicId, masterDoc) → topic row` (with `master_doc`)

- [ ] **Step 1: Write the migration**

`supabase/migrations/0007_master_doc.sql`:
```sql
-- Living topic docs: each topic gets a master markdown document.
alter table topics add column master_doc text not null default '';
```

- [ ] **Step 2: Write the failing test**

Append to `src/lib/db/topics.test.js` (match the existing mock style in that file):
```js
import { describe, test, expect, vi } from 'vitest'
import { updateTopicDoc } from './topics.js'

describe('updateTopicDoc', () => {
  test('updates master_doc and returns the row', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 't1', master_doc: '# Hello' }, error: null })
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    const supabase = { from: vi.fn(() => ({ update })) }

    const row = await updateTopicDoc(supabase, 't1', '# Hello')

    expect(supabase.from).toHaveBeenCalledWith('topics')
    expect(update).toHaveBeenCalledWith({ master_doc: '# Hello' })
    expect(eq).toHaveBeenCalledWith('id', 't1')
    expect(row).toEqual({ id: 't1', master_doc: '# Hello' })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```
npm test -- --run src/lib/db/topics.test.js
```
Expected: FAIL — "updateTopicDoc is not a function"

- [ ] **Step 4: Implement updateTopicDoc**

Append to `src/lib/db/topics.js`:
```js
export async function updateTopicDoc(supabase, topicId, masterDoc) {
  const { data, error } = await supabase
    .from('topics')
    .update({ master_doc: String(masterDoc ?? '') })
    .eq('id', topicId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 5: Run test to verify it passes**

```
npm test -- --run src/lib/db/topics.test.js
```
Expected: PASS

- [ ] **Step 6: Commit**

```
git add supabase/migrations/0007_master_doc.sql src/lib/db/topics.js src/lib/db/topics.test.js
git commit -m "feat: master_doc column + updateTopicDoc"
```

---

### Task 2: computeTitle

**Files:**
- Create: `src/lib/entryTitle.js`
- Create: `src/lib/entryTitle.test.js`

**Interfaces:**
- Produces: `computeTitle(note: string, url: string | null) → string`

- [ ] **Step 1: Write the failing tests**

`src/lib/entryTitle.test.js`:
```js
import { describe, test, expect } from 'vitest'
import { computeTitle } from './entryTitle.js'

describe('computeTitle', () => {
  test('uses first H1 heading', () => {
    expect(computeTitle('# My Heading\n\nbody text', null)).toBe('My Heading')
  })
  test('H1 wins even when not first line', () => {
    expect(computeTitle('\n\n# Real Title\nmore', null)).toBe('Real Title')
  })
  test('falls back to first non-empty line', () => {
    expect(computeTitle('\n\nfirst real line\nsecond', null)).toBe('first real line')
  })
  test('caps first line at 120 chars', () => {
    const long = 'x'.repeat(200)
    expect(computeTitle(long, null)).toBe('x'.repeat(120))
  })
  test('falls back to url when note empty', () => {
    expect(computeTitle('', 'https://example.com/page')).toBe('https://example.com/page')
  })
  test('falls back to url when note whitespace only', () => {
    expect(computeTitle('   \n  ', 'https://example.com')).toBe('https://example.com')
  })
  test('falls back to Untitled when nothing', () => {
    expect(computeTitle('', null)).toBe('Untitled')
    expect(computeTitle('', '')).toBe('Untitled')
  })
  test('trims heading whitespace', () => {
    expect(computeTitle('#    Spaced Title   ', null)).toBe('Spaced Title')
  })
  test('does not treat ## as H1', () => {
    expect(computeTitle('## Subheading\nbody', null)).toBe('## Subheading')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --run src/lib/entryTitle.test.js
```
Expected: FAIL — "computeTitle is not a function"

- [ ] **Step 3: Implement computeTitle**

`src/lib/entryTitle.js`:
```js
const MAX_TITLE = 120

export function computeTitle(note, url) {
  const text = String(note ?? '')
  const lines = text.split('\n')

  // 1. First H1 (single # followed by a space)
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/)
    if (m) return m[1].trim().slice(0, MAX_TITLE)
  }

  // 2. First non-empty line
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) return trimmed.slice(0, MAX_TITLE)
  }

  // 3. URL  4. Untitled
  const u = String(url ?? '').trim()
  return u || 'Untitled'
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --run src/lib/entryTitle.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/lib/entryTitle.js src/lib/entryTitle.test.js
git commit -m "feat: computeTitle entry-title resolution"
```

---

### Task 3: Store computed title on create/update

**Files:**
- Modify: `src/lib/db/entries.js`
- Test: `src/lib/db/entries.test.js`

**Interfaces:**
- Consumes: `computeTitle` from `../entryTitle.js`
- Behavior: `createEntry` and `updateEntry` set `title` from the note when note text is present; explicit non-empty title wins only when note is empty

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/db/entries.test.js`:
```js
import { computeTitle } from '../entryTitle.js'

describe('entry title persistence', () => {
  test('createEntry stores computed title from note H1', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const supabase = { from: vi.fn(() => ({ insert })) }

    await createEntry(supabase, { topicId: 't1', note: '# Cool Note\nbody' })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cool Note' }))
  })

  test('createEntry keeps explicit title when note empty', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const supabase = { from: vi.fn(() => ({ insert })) }

    await createEntry(supabase, { topicId: 't1', note: '', title: 'Fetched Title', url: 'https://x.com' })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fetched Title' }))
  })

  test('updateEntry recomputes title when note updated', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    const supabase = { from: vi.fn(() => ({ update })) }

    await updateEntry(supabase, 'e1', { note: '# New Title\nx' })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }))
  })

  test('updateEntry leaves title alone when note not in patch', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    const supabase = { from: vi.fn(() => ({ update })) }

    await updateEntry(supabase, 'e1', { status: 'done' })

    expect(update).toHaveBeenCalledWith({ status: 'done' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --run src/lib/db/entries.test.js
```
Expected: FAIL — title not present in insert/update args

- [ ] **Step 3: Update entries.js**

In `src/lib/db/entries.js`, add the import at the top (after the existing `buildSearchFilter` import):
```js
import { computeTitle } from '../entryTitle.js'
```

Replace `createEntry` with:
```js
export async function createEntry(supabase, { topicId, url = null, title = null, note = '' }) {
  const noteText = clampNote(note)
  const finalTitle = noteText.trim()
    ? computeTitle(noteText, url)
    : (title || computeTitle('', url))
  const { data, error } = await supabase
    .from('entries')
    .insert({ topic_id: topicId, url: clampUrl(url), title: finalTitle, note: noteText })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```

Replace `updateEntry` with:
```js
export async function updateEntry(supabase, id, patch) {
  const next = { ...patch }
  if (typeof next.note === 'string') {
    next.note = clampNote(next.note)
    next.title = computeTitle(next.note, next.url ?? null)
  }
  const { data, error } = await supabase
    .from('entries')
    .update(next)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 4: Run the full suite**

```
npm test -- --run src/lib/db/entries.test.js
```
Expected: new tests PASS. (Pre-existing failures in `listEntriesByTopic`/`searchEntries`/`listForRevisit` from the mock-chain `.is` issue are unrelated and remain — do not fix here.)

- [ ] **Step 5: Commit**

```
git add src/lib/db/entries.js src/lib/db/entries.test.js
git commit -m "feat: always store computed entry title on create/update"
```

---

### Task 4: fuzzyFind

**Files:**
- Create: `src/lib/fuzzyFind.js`
- Create: `src/lib/fuzzyFind.test.js`

**Interfaces:**
- Produces: `fuzzyFind(query: string, items: object[], keys: string[]) → object[]` (ranked subset; empty query returns all items unchanged)

- [ ] **Step 1: Write the failing tests**

`src/lib/fuzzyFind.test.js`:
```js
import { describe, test, expect } from 'vitest'
import { fuzzyFind } from './fuzzyFind.js'

const items = [
  { id: 1, title: 'React hooks guide', note: 'useEffect and useState' },
  { id: 2, title: 'Postgres indexing', note: 'btree and gin' },
  { id: 3, title: 'Rust ownership', note: 'borrow checker' },
]

describe('fuzzyFind', () => {
  test('empty query returns all items unchanged', () => {
    expect(fuzzyFind('', items, ['title'])).toEqual(items)
  })
  test('matches subsequence in title', () => {
    const r = fuzzyFind('rhg', items, ['title'])
    expect(r[0].id).toBe(1)
  })
  test('matches across multiple keys', () => {
    const r = fuzzyFind('borrow', items, ['title', 'note'])
    expect(r.map((x) => x.id)).toContain(3)
  })
  test('excludes non-matches', () => {
    const r = fuzzyFind('xyz', items, ['title'])
    expect(r).toEqual([])
  })
  test('prefix match ranks higher than scattered match', () => {
    const data = [
      { id: 'a', title: 'advanced rust' },
      { id: 'b', title: 'rust basics' },
    ]
    const r = fuzzyFind('rust', data, ['title'])
    expect(r[0].id).toBe('b') // prefix match wins
  })
  test('is case insensitive', () => {
    const r = fuzzyFind('REACT', items, ['title'])
    expect(r[0].id).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --run src/lib/fuzzyFind.test.js
```
Expected: FAIL — "fuzzyFind is not a function"

- [ ] **Step 3: Implement fuzzyFind**

`src/lib/fuzzyFind.js`:
```js
// Subsequence fuzzy match with prefix + contiguity scoring.
function scoreString(query, target) {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (!q) return 0
  if (t.startsWith(q)) return 1000 - t.length // strong prefix bonus
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak += 1
      score += 1 + streak // contiguous chars score more
      qi += 1
    } else {
      streak = 0
    }
  }
  if (qi < q.length) return -1 // not all query chars matched
  return score
}

export function fuzzyFind(query, items, keys) {
  if (!query || !query.trim()) return items
  const scored = []
  for (const item of items) {
    let best = -1
    for (const key of keys) {
      const val = item[key]
      if (typeof val !== 'string') continue
      const s = scoreString(query.trim(), val)
      if (s > best) best = s
    }
    if (best >= 0) scored.push({ item, score: best })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.item)
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --run src/lib/fuzzyFind.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/lib/fuzzyFind.js src/lib/fuzzyFind.test.js
git commit -m "feat: fuzzyFind in-memory scorer"
```

---

### Task 5: Embed token parsing + expansion

**Files:**
- Create: `src/lib/embeds.js`
- Create: `src/lib/embeds.test.js`

**Interfaces:**
- Produces:
  - `EMBED_RE` — global regex matching `[[entry:UUID]]` / `[[entry:UUID|label]]`
  - `extractEmbedIds(markdown: string) → string[]` — unique entry UUIDs referenced
  - `expandEmbedSyntax(markdown: string, getTitle: (id) => string|null) → string` — converts embed tokens to `[text](entry:UUID)` markdown links; uses label if present, else `getTitle(id)`, else `missing entry`

- [ ] **Step 1: Write the failing tests**

`src/lib/embeds.test.js`:
```js
import { describe, test, expect } from 'vitest'
import { extractEmbedIds, expandEmbedSyntax } from './embeds.js'

const ID = '11111111-1111-1111-1111-111111111111'
const ID2 = '22222222-2222-2222-2222-222222222222'

describe('extractEmbedIds', () => {
  test('pulls unique ids', () => {
    const md = `see [[entry:${ID}]] and [[entry:${ID2}|label]] and [[entry:${ID}]]`
    expect(extractEmbedIds(md)).toEqual([ID, ID2])
  })
  test('empty when none', () => {
    expect(extractEmbedIds('plain text')).toEqual([])
  })
})

describe('expandEmbedSyntax', () => {
  const getTitle = (id) => (id === ID ? 'Real Title' : null)

  test('uses looked-up title when no label', () => {
    expect(expandEmbedSyntax(`x [[entry:${ID}]] y`, getTitle))
      .toBe(`x [Real Title](entry:${ID}) y`)
  })
  test('uses explicit label over title', () => {
    expect(expandEmbedSyntax(`[[entry:${ID}|My Label]]`, getTitle))
      .toBe(`[My Label](entry:${ID})`)
  })
  test('missing entry renders placeholder label', () => {
    expect(expandEmbedSyntax(`[[entry:${ID2}]]`, getTitle))
      .toBe(`[missing entry](entry:${ID2})`)
  })
  test('leaves normal markdown untouched', () => {
    expect(expandEmbedSyntax('[google](https://g.com)', getTitle))
      .toBe('[google](https://g.com)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --run src/lib/embeds.test.js
```
Expected: FAIL — functions not defined

- [ ] **Step 3: Implement embeds.js**

`src/lib/embeds.js`:
```js
// Matches [[entry:UUID]] or [[entry:UUID|label]]
export const EMBED_RE = /\[\[entry:([0-9a-fA-F-]+)(?:\|([^\]]+))?\]\]/g

export function extractEmbedIds(markdown) {
  const ids = []
  const seen = new Set()
  const re = new RegExp(EMBED_RE.source, 'g')
  let m
  while ((m = re.exec(String(markdown ?? '')))) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      ids.push(m[1])
    }
  }
  return ids
}

export function expandEmbedSyntax(markdown, getTitle) {
  return String(markdown ?? '').replace(
    new RegExp(EMBED_RE.source, 'g'),
    (_full, id, label) => {
      const text = label || getTitle(id) || 'missing entry'
      return `[${text}](entry:${id})`
    }
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --run src/lib/embeds.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/lib/embeds.js src/lib/embeds.test.js
git commit -m "feat: embed token parsing and expansion to entry: links"
```

---

### Task 6: Styles

**Files:**
- Modify: `src/styles.css` (append)

- [ ] **Step 1: Append styles**

Add to the end of `src/styles.css`:
```css
/* ── Topic view layout ───────────────────────────────────────────────────────── */
.topic-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.topic-header h2 {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  color: var(--text);
}
.view-toggle { display: flex; gap: 4px; }
.view-toggle button {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
}
.view-toggle button.active { background: var(--accent-weak); color: var(--accent); border-color: var(--accent); }

.master-doc {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 22px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.master-doc-empty {
  color: var(--muted);
  font-style: italic;
  cursor: pointer;
}
.master-doc-empty:hover { color: var(--accent); }

.search-scope { display: flex; gap: 6px; align-items: center; }
.search-scope select {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
}

/* ── Entry embed chip ─────────────────────────────────────────────────────────── */
.entry-embed {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: 5px;
  background: var(--accent-weak);
  color: var(--accent);
  border: none;
  font-size: inherit;
  cursor: pointer;
  text-decoration: none;
}
.entry-embed:hover { background: var(--surface-3); }
.entry-embed.missing { background: transparent; color: var(--muted); border: 1px dashed var(--border); cursor: default; }

/* ── Embed hover preview popover ──────────────────────────────────────────────── */
.embed-popover {
  position: fixed;
  z-index: 1100;
  max-width: 320px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.16);
  padding: 10px 12px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text);
  pointer-events: none;
}
.embed-popover .pop-title { font-weight: 600; font-family: var(--font-serif); margin-bottom: 4px; }
.embed-popover img { max-width: 100%; border-radius: 4px; margin-bottom: 6px; display: block; }
.embed-popover .pop-text { color: var(--muted); white-space: pre-wrap; }

/* ── Return-to-position button ────────────────────────────────────────────────── */
.return-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 900;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 3px 12px rgba(0,0,0,0.2);
  cursor: pointer;
}
.return-btn:hover { background: var(--accent); opacity: 0.9; }

/* ── Jump highlight pulse ─────────────────────────────────────────────────────── */
.card.jump-highlight { animation: jump-pulse 1.4s ease-out; }
@keyframes jump-pulse {
  0% { box-shadow: 0 0 0 3px var(--accent); }
  100% { box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
}

/* ── [[ autocomplete dropdown (CodeMirror) ────────────────────────────────────── */
.cm-tooltip-autocomplete .cm-completionLabel { font-size: 13px; }
.cm-tooltip-autocomplete .cm-completionDetail {
  font-size: 11px;
  color: var(--muted);
  font-style: normal;
  margin-left: 8px;
}
```

- [ ] **Step 2: Commit**

```
git add src/styles.css
git commit -m "feat: living topic docs styles"
```

---

### Task 7: ReturnButton

**Files:**
- Create: `src/components/ReturnButton.jsx`
- Create: `src/components/ReturnButton.test.jsx`

**Interfaces:**
- Produces: `<ReturnButton onReturn={fn} />` — renders a fixed button labelled "↑ Return"; calls `onReturn` on click

- [ ] **Step 1: Write the failing test**

`src/components/ReturnButton.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { test, expect, vi } from 'vitest'
import ReturnButton from './ReturnButton.jsx'

test('renders and fires onReturn', async () => {
  const onReturn = vi.fn()
  render(<ReturnButton onReturn={onReturn} />)
  await userEvent.click(screen.getByRole('button', { name: /return/i }))
  expect(onReturn).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --run src/components/ReturnButton.test.jsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement ReturnButton**

`src/components/ReturnButton.jsx`:
```jsx
export default function ReturnButton({ onReturn }) {
  return (
    <button className="return-btn" onClick={onReturn}>
      ↑ Return
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --run src/components/ReturnButton.test.jsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/components/ReturnButton.jsx src/components/ReturnButton.test.jsx
git commit -m "feat: ReturnButton component"
```

---

### Task 8: EntryEmbed chip + hover preview + jump

**Files:**
- Create: `src/components/EntryEmbed.jsx`
- Create: `src/components/EntryEmbed.test.jsx`

**Interfaces:**
- Consumes: `classifyUrl` from `../lib/classifyUrl.js`; `getYouTubeThumbnail` from `../lib/youtube.js`
- Produces: `<EntryEmbed entryId={string} label={node} getEntry={(id)=>entry|null} onJump={(id)=>void} />`
  - `entry` shape: `{ id, title, url, note }`
  - Renders chip with type icon + label; missing entry → greyed `missing` chip
  - Hover (mouseenter) / long-press shows popover with media (if any) + note text; click fires `onJump(entryId)`

- [ ] **Step 1: Write the failing tests**

`src/components/EntryEmbed.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { test, expect, vi } from 'vitest'
import EntryEmbed from './EntryEmbed.jsx'

const entry = { id: 'e1', title: 'My Entry', url: 'https://example.com', note: 'some note text' }
const getEntry = (id) => (id === 'e1' ? entry : null)

test('renders chip with label and fires onJump on click', async () => {
  const onJump = vi.fn()
  render(<EntryEmbed entryId="e1" label="My Entry" getEntry={getEntry} onJump={onJump} />)
  const chip = screen.getByRole('button', { name: /my entry/i })
  await userEvent.click(chip)
  expect(onJump).toHaveBeenCalledWith('e1')
})

test('shows popover with note text on hover', async () => {
  render(<EntryEmbed entryId="e1" label="My Entry" getEntry={getEntry} onJump={() => {}} />)
  await userEvent.hover(screen.getByRole('button', { name: /my entry/i }))
  expect(await screen.findByText(/some note text/i)).toBeInTheDocument()
})

test('missing entry renders greyed chip and does not jump', async () => {
  const onJump = vi.fn()
  render(<EntryEmbed entryId="gone" label="x" getEntry={getEntry} onJump={onJump} />)
  const chip = screen.getByText(/missing entry/i)
  await userEvent.click(chip)
  expect(onJump).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --run src/components/EntryEmbed.test.jsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement EntryEmbed**

`src/components/EntryEmbed.jsx`:
```jsx
import { useRef, useState } from 'react'
import { classifyUrl } from '../lib/classifyUrl.js'
import { getYouTubeThumbnail, isYouTubeUrl } from '../lib/youtube.js'

function iconFor(entry) {
  if (!entry) return '⚠'
  if (entry.url && isYouTubeUrl(entry.url)) return '🎥'
  const t = entry.url ? classifyUrl(entry.url) : null
  if (t === 'pdf') return '📄'
  if (t === 'image') return '🖼'
  if (t === 'drive') return '🔗'
  if (entry.url) return '🔗'
  return '📝'
}

function popoverMedia(entry) {
  if (!entry?.url) return null
  if (isYouTubeUrl(entry.url)) return getYouTubeThumbnail(entry.url)
  if (classifyUrl(entry.url) === 'image') return entry.url
  return null
}

const LONG_PRESS_MS = 400

export default function EntryEmbed({ entryId, label, getEntry, onJump }) {
  const entry = getEntry(entryId)
  const [pop, setPop] = useState(null) // {x, y} or null
  const pressTimer = useRef(null)
  const chipRef = useRef(null)

  if (!entry) {
    return <span className="entry-embed missing">⚠ missing entry</span>
  }

  function showPopover() {
    const rect = chipRef.current?.getBoundingClientRect()
    if (rect) setPop({ x: rect.left, y: rect.bottom + 6 })
  }
  function hidePopover() { setPop(null) }

  function onClick() {
    hidePopover()
    onJump(entryId)
  }
  function onTouchStart() {
    pressTimer.current = setTimeout(showPopover, LONG_PRESS_MS)
  }
  function onTouchEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  const media = popoverMedia(entry)
  const text = (entry.note || '').split('\n').filter(Boolean).slice(0, 4).join('\n').slice(0, 200)

  return (
    <>
      <button
        ref={chipRef}
        className="entry-embed"
        onClick={onClick}
        onMouseEnter={showPopover}
        onMouseLeave={hidePopover}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {iconFor(entry)} {label || entry.title}
      </button>
      {pop && (
        <div className="embed-popover" style={{ left: pop.x, top: pop.y }}>
          <div className="pop-title">{entry.title}</div>
          {media && <img src={media} alt="" loading="lazy" onError={(e) => { e.target.style.display = 'none' }} />}
          {text && <div className="pop-text">{text}</div>}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --run src/components/EntryEmbed.test.jsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/components/EntryEmbed.jsx src/components/EntryEmbed.test.jsx
git commit -m "feat: EntryEmbed chip with hover preview and jump"
```

---

### Task 9: Wire embeds into MarkdownView

**Files:**
- Modify: `src/components/MarkdownView.jsx`
- Test: `src/components/MarkdownView.test.jsx` (create if absent)

**Interfaces:**
- Consumes: `expandEmbedSyntax` from `../lib/embeds.js`; `EntryEmbed` from `./EntryEmbed.jsx`
- `MarkdownView` gains props: `getEntry`, `onJump` (both optional). When present, `[[entry:]]` tokens render as `<EntryEmbed>`; an `entry:`-scheme link in `components.a` maps to `<EntryEmbed>`.

- [ ] **Step 1: Write the failing test**

`src/components/MarkdownView.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import MarkdownView from './MarkdownView.jsx'

const ID = '11111111-1111-1111-1111-111111111111'
const entry = { id: ID, title: 'Embedded Entry', url: null, note: 'hi' }
const getEntry = (id) => (id === ID ? entry : null)

test('renders embed token as a chip showing the entry title', () => {
  render(
    <MarkdownView getEntry={getEntry} onJump={() => {}}>
      {`Look: [[entry:${ID}]] done`}
    </MarkdownView>
  )
  expect(screen.getByRole('button', { name: /embedded entry/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --run src/components/MarkdownView.test.jsx
```
Expected: FAIL — token rendered as raw text, no button

- [ ] **Step 3: Update MarkdownView**

Replace the full contents of `src/components/MarkdownView.jsx` with:
```jsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LinkEmbed, { isPdfUrl } from './LinkEmbed.jsx'
import EntryEmbed from './EntryEmbed.jsx'
import { getYouTubeId } from '../lib/youtube.js'
import { classifyUrl } from '../lib/classifyUrl.js'
import { expandEmbedSyntax } from '../lib/embeds.js'

function isParagraphOnlyLink(node) {
  if (!node?.children || node.children.length !== 1) return null
  const child = node.children[0]
  if (child.type !== 'element' || child.tagName !== 'a') return null
  const href = child.properties?.href
  return typeof href === 'string' ? href : null
}

function shouldEmbedLink(href) {
  if (!href || href.startsWith('#') || href.startsWith('entry:')) return false
  if (getYouTubeId(href) || isPdfUrl(href)) return true
  try {
    const u = new URL(href)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function buildMarkdownComponents({ onPreview, getEntry, onJump } = {}) {
  const FILE_ICONS = { pdf: '📄', image: '🖼', text: '📝', drive: '🔗' }
  return {
    a: ({ href, children, ...props }) => {
      if (href && href.startsWith('entry:') && getEntry) {
        const id = href.slice('entry:'.length)
        return <EntryEmbed entryId={id} label={children} getEntry={getEntry} onJump={onJump || (() => {})} />
      }
      const fileType = href ? classifyUrl(href) : null
      if (fileType && onPreview) {
        return (
          <button className="file-chip" onClick={() => onPreview(href)}>
            {FILE_ICONS[fileType]} {children}
          </button>
        )
      }
      if (href && isPdfUrl(href)) {
        return <LinkEmbed url={href} />
      }
      return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
    },
    p: ({ node, children, ...props }) => {
      const href = isParagraphOnlyLink(node)
      if (href && shouldEmbedLink(href)) {
        return <LinkEmbed url={href} />
      }
      return <p {...props}>{children}</p>
    },
    img: ({ src, alt, ...props }) => (
      <img className="note-image" src={src} alt={alt ?? ''} loading="lazy" {...props} />
    ),
  }
}

export default function MarkdownView({ children, className = 'note', onPreview, getEntry, onJump }) {
  const source = getEntry
    ? expandEmbedSyntax(String(children ?? ''), (id) => getEntry(id)?.title || null)
    : String(children ?? '')
  const components = buildMarkdownComponents({ onPreview, getEntry, onJump })
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
```

**Note:** this supersedes the `buildMarkdownComponents(onPreview)` signature from the file-preview plan — it now takes an options object. If the file-preview plan's `EntryCard` change calls `<MarkdownView onPreview={...}>`, that still works (named prop). No other caller uses `buildMarkdownComponents` directly.

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --run src/components/MarkdownView.test.jsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/components/MarkdownView.jsx src/components/MarkdownView.test.jsx
git commit -m "feat: render [[entry:]] embeds as chips in MarkdownView"
```

---

### Task 10: `[[` autocomplete completion source + NoteEditor extension hook

**Files:**
- Create: `src/lib/entryAutocomplete.js`
- Create: `src/lib/entryAutocomplete.test.js`
- Modify: `src/components/NoteEditor.jsx`

**Interfaces:**
- Consumes: `fuzzyFind` from `../lib/fuzzyFind.js`; `@codemirror/autocomplete`
- Produces:
  - `filterCandidates(query, candidates, { scope, currentTopicId }) → candidates[]` (pure, testable). `candidate` shape: `{ id, title, topicId, topicName }`
  - `makeEntryCompletion(getCandidates, getScopeCtx)` → a CodeMirror `autocompletion` extension. `getCandidates()` returns `candidate[]`; `getScopeCtx()` returns `{ scope: 'topic'|'all', currentTopicId }`
  - `NoteEditor` gains optional prop `extraExtensions = []` appended to the CodeMirror `extensions` array

- [ ] **Step 1: Install @codemirror/autocomplete**

```
npm install @codemirror/autocomplete
```

- [ ] **Step 2: Write the failing test for filterCandidates**

`src/lib/entryAutocomplete.test.js`:
```js
import { describe, test, expect } from 'vitest'
import { filterCandidates } from './entryAutocomplete.js'

const cands = [
  { id: '1', title: 'React hooks', topicId: 'tA', topicName: 'Frontend' },
  { id: '2', title: 'Rust basics', topicId: 'tB', topicName: 'Systems' },
  { id: '3', title: 'Redux guide', topicId: 'tA', topicName: 'Frontend' },
]

describe('filterCandidates', () => {
  test('topic scope keeps only current topic', () => {
    const r = filterCandidates('', cands, { scope: 'topic', currentTopicId: 'tA' })
    expect(r.map((c) => c.id).sort()).toEqual(['1', '3'])
  })
  test('all scope keeps everything', () => {
    const r = filterCandidates('', cands, { scope: 'all', currentTopicId: 'tA' })
    expect(r.length).toBe(3)
  })
  test('fuzzy filters by query within scope', () => {
    const r = filterCandidates('red', cands, { scope: 'all', currentTopicId: 'tA' })
    expect(r[0].id).toBe('3') // Redux prefix
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```
npm test -- --run src/lib/entryAutocomplete.test.js
```
Expected: FAIL — "filterCandidates is not a function"

- [ ] **Step 4: Implement entryAutocomplete.js**

`src/lib/entryAutocomplete.js`:
```js
import { autocompletion } from '@codemirror/autocomplete'
import { fuzzyFind } from './fuzzyFind.js'

export function filterCandidates(query, candidates, { scope, currentTopicId }) {
  const scoped = scope === 'all'
    ? candidates
    : candidates.filter((c) => c.topicId === currentTopicId)
  return fuzzyFind(query, scoped, ['title'])
}

// CodeMirror completion source: triggers after "[[".
export function makeEntryCompletion(getCandidates, getScopeCtx) {
  function source(context) {
    const before = context.matchBefore(/\[\[([^\]]*)$/)
    if (!before) return null
    const query = before.text.slice(2) // strip the "[["
    if (!context.explicit && before.from === before.to) return null

    const ctx = getScopeCtx()
    const matches = filterCandidates(query, getCandidates(), ctx).slice(0, 20)

    return {
      from: before.from,
      options: matches.map((c) => ({
        label: c.title,
        detail: ctx.scope === 'all' ? c.topicName : undefined,
        apply: `[[entry:${c.id}]]`,
      })),
    }
  }
  return autocompletion({ override: [source] })
}
```

- [ ] **Step 5: Run test to verify it passes**

```
npm test -- --run src/lib/entryAutocomplete.test.js
```
Expected: PASS

- [ ] **Step 6: Add extraExtensions prop to NoteEditor**

In `src/components/NoteEditor.jsx`, change the component signature:
```jsx
export default function NoteEditor({ value, onChange, supabase, extraExtensions = [] }) {
```

And update the `<CodeMirror>` `extensions` prop to append them:
```jsx
extensions={[
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  mdKeymap,
  ...extraExtensions,
]}
```

(If Task 6 of the file-preview plan already added `pairKeymap`, include it: `mdKeymap, pairKeymap, ...extraExtensions`.)

- [ ] **Step 7: Run the NoteEditor tests**

```
npm test -- --run src/components/NoteEditor.test.jsx
```
Expected: PASS (extraExtensions defaults to empty, no behavior change)

- [ ] **Step 8: Commit**

```
git add src/lib/entryAutocomplete.js src/lib/entryAutocomplete.test.js src/components/NoteEditor.jsx package.json package-lock.json
git commit -m "feat: [[ entry autocomplete source + NoteEditor extension hook"
```

---

### Task 11: TopicDocEditor

**Files:**
- Create: `src/components/TopicDocEditor.jsx`

**Interfaces:**
- Consumes: `NoteEditor`; `makeEntryCompletion` from `../lib/entryAutocomplete.js`; `updateTopicDoc` from `../lib/db/topics.js`; `supabase`
- Produces: `<TopicDocEditor topicId={string} initialDoc={string} candidates={candidate[]} scopeCtxRef={ref} onChange={(doc)=>void} />`
  - Renders `NoteEditor` with the `[[` autocomplete extension
  - Debounced autosave (800ms) to `updateTopicDoc`
  - Calls `onChange(doc)` immediately so parent preview/embeds stay live

- [ ] **Step 1: Implement TopicDocEditor**

`src/components/TopicDocEditor.jsx`:
```jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import NoteEditor from './NoteEditor.jsx'
import { makeEntryCompletion } from '../lib/entryAutocomplete.js'
import { updateTopicDoc } from '../lib/db/topics.js'
import { supabase } from '../lib/supabaseClient.js'

export default function TopicDocEditor({ topicId, initialDoc, candidates, scopeCtxRef, onChange }) {
  const [doc, setDoc] = useState(initialDoc || '')
  const saveTimer = useRef(null)
  const candidatesRef = useRef(candidates)
  candidatesRef.current = candidates

  useEffect(() => { setDoc(initialDoc || '') }, [topicId, initialDoc])

  const completion = useMemo(
    () => makeEntryCompletion(
      () => candidatesRef.current,
      () => scopeCtxRef.current,
    ),
    [scopeCtxRef],
  )

  function handleChange(next) {
    setDoc(next)
    onChange(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateTopicDoc(supabase, topicId, next).catch(() => {})
    }, 800)
  }

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  return (
    <NoteEditor
      value={doc}
      onChange={handleChange}
      supabase={supabase}
      extraExtensions={[completion]}
    />
  )
}
```

- [ ] **Step 2: Manual smoke test**

```
npm run dev
```
(Can't fully exercise until Task 12 wires it in. This step verifies the module imports without error — confirm no console error on app load.)

- [ ] **Step 3: Commit**

```
git add src/components/TopicDocEditor.jsx
git commit -m "feat: TopicDocEditor with [[ autocomplete and autosave"
```

---

### Task 12: TopicView — compose doc + scoped search + entry list + toggle

**Files:**
- Create: `src/components/TopicView.jsx`
- Create: `src/components/TopicView.test.jsx`
- Modify: `src/components/EntryList.jsx` (add `onJump` highlight support + `onPreview` passthrough)

**Interfaces:**
- Consumes: `TopicDocEditor`, `MarkdownView`, `SearchBar`/inline search, `EntryList`, `QuickAdd`; `fuzzyFind` from `../lib/fuzzyFind.js`; `extractEmbedIds` from `../lib/embeds.js`
- Produces: `<TopicView topic={topic} entries={entry[]} allCandidates={candidate[]} onAddEntry onDelete onStatusChange onTagsChange onTogglePin onNoteSave onPreview onDocChange />`
  - `topic` shape: `{ id, name, master_doc }`
  - Doc⇄List toggle (localStorage `medialog_topic_view_{id}`)
  - Scoped fuzzy search: `topic` | `doc` | `all`
  - Click embed chip → scroll to `#entry-{id}`, pulse highlight, show ReturnButton

- [ ] **Step 1: Add onJump highlight + onPreview to EntryList**

Replace `src/components/EntryList.jsx` with:
```jsx
import EntryCard from './EntryCard.jsx'

export default function EntryList({ entries, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview }) {
  if (entries.length === 0) return <p>No entries yet.</p>
  return (
    <div>
      {entries.map((e) => (
        <EntryCard
          key={e.id}
          entry={e}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onTagsChange={onTagsChange}
          onTogglePin={onTogglePin}
          onNoteSave={onNoteSave}
          onPreview={onPreview}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write the failing test**

`src/components/TopicView.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { test, expect, vi } from 'vitest'
import TopicView from './TopicView.jsx'

vi.mock('./TopicDocEditor.jsx', () => ({ default: () => <div>doc editor</div> }))

const topic = { id: 't1', name: 'My Topic', master_doc: '' }
const entries = [
  { id: 'e1', title: 'Alpha note', note: 'alpha', url: null, tags: [], created_at: new Date().toISOString() },
  { id: 'e2', title: 'Beta note', note: 'beta', url: null, tags: [], created_at: new Date().toISOString() },
]
const noop = () => {}
const props = {
  topic, entries, allCandidates: [],
  onAddEntry: noop, onDelete: noop, onStatusChange: noop,
  onTagsChange: noop, onTogglePin: noop, onNoteSave: noop,
  onPreview: noop, onDocChange: noop,
}

test('scoped search filters the entry list', async () => {
  render(<TopicView {...props} />)
  expect(screen.getByText('Alpha note')).toBeInTheDocument()
  expect(screen.getByText('Beta note')).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText(/search/i), 'alpha')
  expect(screen.getByText('Alpha note')).toBeInTheDocument()
  expect(screen.queryByText('Beta note')).not.toBeInTheDocument()
})

test('view toggle shows/hides the master doc editor', async () => {
  render(<TopicView {...props} />)
  // default for a topic with empty doc is List → no editor
  expect(screen.queryByText('doc editor')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^doc$/i }))
  expect(screen.getByText('doc editor')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run test to verify it fails**

```
npm test -- --run src/components/TopicView.test.jsx
```
Expected: FAIL — module not found

- [ ] **Step 4: Implement TopicView**

`src/components/TopicView.jsx`:
```jsx
import { useMemo, useRef, useState } from 'react'
import TopicDocEditor from './TopicDocEditor.jsx'
import MarkdownView from './MarkdownView.jsx'
import EntryList from './EntryList.jsx'
import QuickAdd from './QuickAdd.jsx'
import ReturnButton from './ReturnButton.jsx'
import { fuzzyFind } from '../lib/fuzzyFind.js'
import { extractEmbedIds } from '../lib/embeds.js'

const SCOPES = [
  { value: 'topic', label: 'This topic' },
  { value: 'doc', label: 'This doc' },
  { value: 'all', label: 'Everything' },
]

export default function TopicView({
  topic, entries, allCandidates,
  onAddEntry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onDocChange,
}) {
  const storageKey = `medialog_topic_view_${topic.id}`
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) return saved
    return topic.master_doc ? 'doc' : 'list'
  })
  const [docEditing, setDocEditing] = useState(false)
  const [liveDoc, setLiveDoc] = useState(topic.master_doc || '')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('topic')
  const [returnY, setReturnY] = useState(null)

  const scopeCtxRef = useRef({ scope: 'topic', currentTopicId: topic.id })

  function setView(next) {
    setMode(next)
    localStorage.setItem(storageKey, next)
  }

  const getEntry = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e]))
    return (id) => byId.get(id) || null
  }, [entries])

  const docEmbedIds = useMemo(() => new Set(extractEmbedIds(liveDoc)), [liveDoc])

  const filtered = useMemo(() => {
    let pool = entries
    if (scope === 'doc') pool = entries.filter((e) => docEmbedIds.has(e.id))
    return fuzzyFind(query, pool, ['title', 'note'])
  }, [entries, query, scope, docEmbedIds])

  function handleJump(entryId) {
    setReturnY(window.scrollY)
    const el = document.getElementById(`entry-${entryId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('jump-highlight')
      setTimeout(() => el.classList.remove('jump-highlight'), 1500)
    }
  }

  function handleReturn() {
    if (returnY != null) window.scrollTo({ top: returnY, behavior: 'smooth' })
    setReturnY(null)
  }

  function handleDocChange(next) {
    setLiveDoc(next)
    onDocChange(next)
  }

  return (
    <>
      <div className="topic-header">
        <h2>{topic.name}</h2>
        <div className="view-toggle">
          <button className={mode === 'doc' ? 'active' : ''} onClick={() => setView('doc')}>Doc</button>
          <button className={mode === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {mode === 'doc' && (
        <div className="master-doc">
          {docEditing ? (
            <TopicDocEditor
              topicId={topic.id}
              initialDoc={topic.master_doc || ''}
              candidates={allCandidates}
              scopeCtxRef={scopeCtxRef}
              onChange={handleDocChange}
            />
          ) : liveDoc.trim() ? (
            <div onClick={() => setDocEditing(true)} style={{ cursor: 'text' }}>
              <MarkdownView getEntry={getEntry} onJump={handleJump} onPreview={onPreview}>
                {liveDoc}
              </MarkdownView>
            </div>
          ) : (
            <span className="master-doc-empty" onClick={() => setDocEditing(true)}>
              Write a master doc for this topic — embed entries with [[
            </span>
          )}
        </div>
      )}

      <div className="search-scope">
        <input
          className="searchbar"
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {!query && <QuickAdd onAdd={onAddEntry} disabled={false} />}

      <EntryList
        entries={filtered}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onTagsChange={onTagsChange}
        onTogglePin={onTogglePin}
        onNoteSave={onNoteSave}
        onPreview={onPreview}
      />

      {returnY != null && <ReturnButton onReturn={handleReturn} />}
    </>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```
npm test -- --run src/components/TopicView.test.jsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```
git add src/components/TopicView.jsx src/components/TopicView.test.jsx src/components/EntryList.jsx
git commit -m "feat: TopicView with master doc, scoped search, jump"
```

---

### Task 13: Wire TopicView into App + load candidate index

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `TopicView`; existing `listEntriesByTopic`, handlers
- Behavior: browse view renders `<TopicView>`; an entry candidate index `{id, title, topicId, topicName}[]` for `[[` autocomplete is built from loaded entries (current topic always; lazily extended); `master_doc` is read from the selected topic row and persisted via `updateTopicDoc` (inside TopicDocEditor)

- [ ] **Step 1: Build the candidate index + render TopicView**

In `src/App.jsx`:

`listTopics` already returns `master_doc` (it `select('*')`). Confirm the selected topic object is available — it is via `topics.find`.

Add a candidate index built from the currently loaded `entries` plus topic names. Inside `Workspace()`, after the `entries` state and `selectedId`:
```js
const selectedTopic = topics.find((t) => t.id === selectedId) || null

const candidateIndex = useMemo(() => {
  const topicName = selectedTopic?.name || ''
  return entries.map((e) => ({
    id: e.id,
    title: e.title || 'Untitled',
    topicId: selectedId,
    topicName,
  }))
}, [entries, selectedId, selectedTopic])
```

Add `useMemo` to the React import if not present.

Add a doc-change persistence handler (TopicDocEditor autosaves, but App keeps topic state fresh):
```js
function handleDocChange(topicId, doc) {
  setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, master_doc: doc } : t)))
}
```

Replace the entire `{view === 'browse' && (...)}` block in the render with:
```jsx
{view === 'browse' && selectedTopic && (
  <>
    {query ? (
      <>
        <SearchBar value={query} onChange={setQuery} />
        <EntryList
          entries={entries}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onTagsChange={handleTagsChange}
          onTogglePin={handleTogglePin}
          onNoteSave={handleNoteSave}
          onPreview={openPreview}
        />
      </>
    ) : (
      <TopicView
        key={selectedTopic.id}
        topic={selectedTopic}
        entries={entries}
        allCandidates={candidateIndex}
        onAddEntry={handleAddEntry}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onTagsChange={handleTagsChange}
        onTogglePin={handleTogglePin}
        onNoteSave={handleNoteSave}
        onPreview={openPreview}
        onDocChange={(doc) => handleDocChange(selectedTopic.id, doc)}
      />
    )}
  </>
)}
```

Add `import TopicView from './components/TopicView.jsx'` to the imports.

**Note:** the global search bar still works (typing in it switches to the flat search list). `openPreview` comes from the file-preview plan's `useFilePreview`; if that plan is not yet merged, pass `undefined` — `onPreview` is optional throughout.

- [ ] **Step 2: Run the full suite**

```
npm test -- --run
```
Expected: all previously-passing tests still pass; pre-existing 4 mock-chain failures unchanged.

- [ ] **Step 3: Manual smoke test**

```
npm run dev
```
Verify on the deployed/local app:
- Select a topic → see header, Doc/List toggle, search+scope, QuickAdd, entries
- Topic with empty doc defaults to List; click Doc → see the "Write a master doc…" prompt
- Click prompt → CodeMirror editor opens; type `# Heading` then `[[` → autocomplete dropdown of this topic's entry titles appears
- Pick an entry → `[[entry:UUID]]` inserted; click outside / switch the doc to rendered (click away from editor) → chip shows the entry's title
- Hover the chip → preview popover with note text (and thumbnail if the entry is a YouTube/image URL)
- Click the chip → page scrolls to that entry, it pulses; a "↑ Return" button appears bottom-right → click it → scroll back
- Search box: type a query → entry list filters; change scope to "This doc" → only embedded entries show
- Reload → the Doc/List choice persisted; the master doc text persisted

- [ ] **Step 4: Commit**

```
git add src/App.jsx
git commit -m "feat: wire TopicView + candidate index into browse"
```

---

### Task 14: `[[#` heading references + anchor navigation

**Files:**
- Create: `src/lib/headingSlug.js`
- Create: `src/lib/headingSlug.test.js`
- Modify: `src/lib/entryAutocomplete.js`
- Modify: `src/components/MarkdownView.jsx`

**Interfaces:**
- Consumes: `fuzzyFind` from `./fuzzyFind.js`; `@codemirror/autocomplete`; `rehype-slug`
- Produces:
  - `slugify(text: string) → string` — GitHub-style slug (lowercase, strip punctuation, spaces→`-`)
  - `parseHeadings(markdown: string) → { text, slug, level }[]` — ATX headings with de-duplicated slugs (`-1`, `-2` suffixes in document order, GitHub rule)
  - `makeEntryCompletion(...)` (extended) — when the text before the cursor is `[[#…`, completes against headings parsed from the current doc and inserts `[Heading](#slug)`; otherwise unchanged (entry completion)
  - `MarkdownView` renders heading `id`s via `rehype-slug`; `#`-anchor links smooth-scroll

- [ ] **Step 1: Install rehype-slug**

```
npm install rehype-slug
```

- [ ] **Step 2: Write the failing tests for headingSlug**

`src/lib/headingSlug.test.js`:
```js
import { describe, test, expect } from 'vitest'
import { slugify, parseHeadings } from './headingSlug.js'

describe('slugify', () => {
  test('lowercases and hyphenates spaces', () => {
    expect(slugify('Getting Started')).toBe('getting-started')
  })
  test('strips punctuation', () => {
    expect(slugify('What is it? (v2)')).toBe('what-is-it-v2')
  })
  test('collapses multiple spaces/hyphens', () => {
    expect(slugify('a   b --- c')).toBe('a-b-c')
  })
  test('trims leading/trailing hyphens', () => {
    expect(slugify('  Hello!  ')).toBe('hello')
  })
})

describe('parseHeadings', () => {
  test('extracts ATX headings with level and slug', () => {
    const md = '# Intro\n\ntext\n\n## Details\n### Deep'
    expect(parseHeadings(md)).toEqual([
      { text: 'Intro', slug: 'intro', level: 1 },
      { text: 'Details', slug: 'details', level: 2 },
      { text: 'Deep', slug: 'deep', level: 3 },
    ])
  })
  test('ignores non-heading lines and # without space', () => {
    expect(parseHeadings('#nospace\nplain text')).toEqual([])
  })
  test('de-duplicates repeated heading slugs in document order', () => {
    const md = '# Notes\n## Notes\n## Notes'
    expect(parseHeadings(md).map((h) => h.slug)).toEqual(['notes', 'notes-1', 'notes-2'])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```
npm test -- --run src/lib/headingSlug.test.js
```
Expected: FAIL — functions not defined

- [ ] **Step 4: Implement headingSlug.js**

`src/lib/headingSlug.js`:
```js
// GitHub-style slug: lowercase, drop non-word chars (keep spaces/hyphens), spaces→-, collapse, trim.
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')   // drop punctuation
    .trim()
    .replace(/[\s-]+/g, '-')    // collapse whitespace/hyphen runs to single -
    .replace(/^-+|-+$/g, '')    // trim leading/trailing -
}

// Parse ATX headings (# .. ######) into { text, slug, level } with GitHub-style
// duplicate-slug suffixing (-1, -2, ...) in document order.
export function parseHeadings(markdown) {
  const out = []
  const counts = new Map()
  for (const line of String(markdown ?? '').split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!m) continue
    const level = m[1].length
    const text = m[2]
    const base = slugify(text)
    const n = counts.get(base) ?? 0
    counts.set(base, n + 1)
    const slug = n === 0 ? base : `${base}-${n}`
    out.push({ text, slug, level })
  }
  return out
}
```

- [ ] **Step 5: Run test to verify it passes**

```
npm test -- --run src/lib/headingSlug.test.js
```
Expected: PASS

- [ ] **Step 6: Extend makeEntryCompletion for `[[#` headings**

In `src/lib/entryAutocomplete.js`, add the import at the top:
```js
import { parseHeadings } from './headingSlug.js'
```

Change `makeEntryCompletion` to accept a getter for the current doc text and branch on `[[#`. Replace the existing `makeEntryCompletion` with:
```js
// getCandidates(): entry candidate[]; getScopeCtx(): { scope, currentTopicId };
// getDocText(): current editor doc string (for [[# heading completion).
export function makeEntryCompletion(getCandidates, getScopeCtx, getDocText = () => '') {
  function source(context) {
    // Heading reference: [[#query
    const headingBefore = context.matchBefore(/\[\[#([^\]]*)$/)
    if (headingBefore) {
      const query = headingBefore.text.slice(3) // strip "[[#"
      const headings = parseHeadings(getDocText())
      const matches = fuzzyFind(query, headings, ['text']).slice(0, 20)
      return {
        from: headingBefore.from,
        options: matches.map((h) => ({
          label: h.text,
          detail: '#'.repeat(h.level),
          apply: `[${h.text}](#${h.slug})`,
        })),
      }
    }

    // Entry embed: [[query  (but not [[# — handled above)
    const before = context.matchBefore(/\[\[([^#\]][^\]]*|)$/)
    if (!before) return null
    const query = before.text.slice(2) // strip the "[["
    if (!context.explicit && before.from === before.to) return null

    const ctx = getScopeCtx()
    const matches = filterCandidates(query, getCandidates(), ctx).slice(0, 20)
    return {
      from: before.from,
      options: matches.map((c) => ({
        label: c.title,
        detail: ctx.scope === 'all' ? c.topicName : undefined,
        apply: `[[entry:${c.id}]]`,
      })),
    }
  }
  return autocompletion({ override: [source] })
}
```

(`filterCandidates` and the imports of `autocompletion`/`fuzzyFind` from Task 10 stay as-is.)

- [ ] **Step 7: Pass the doc text getter from TopicDocEditor**

In `src/components/TopicDocEditor.jsx`, the `makeEntryCompletion` call currently passes two args. Add a third that returns the live doc. Since `doc` is component state, use a ref to avoid stale closures — add near the other refs:
```js
const docRef = useRef(doc)
docRef.current = doc
```
and update the `useMemo` that builds `completion`:
```js
const completion = useMemo(
  () => makeEntryCompletion(
    () => candidatesRef.current,
    () => scopeCtxRef.current,
    () => docRef.current,
  ),
  [scopeCtxRef],
)
```

- [ ] **Step 8: Add rehype-slug + anchor smooth-scroll to MarkdownView**

In `src/components/MarkdownView.jsx`:

Add the import:
```js
import rehypeSlug from 'rehype-slug'
```

Add `rehypeSlug` to the `ReactMarkdown` rehype plugins. Find the `<ReactMarkdown remarkPlugins={[remarkGfm]} ...>` and add `rehypePlugins={[rehypeSlug]}`:
```jsx
<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={components}>
  {source}
</ReactMarkdown>
```

In `buildMarkdownComponents`, update the `a` renderer so a `#`-anchor href smooth-scrolls. Add this branch FIRST inside the `a` renderer (before the `entry:` and file-chip branches):
```jsx
if (href && href.startsWith('#')) {
  return (
    <a
      href={href}
      onClick={(e) => {
        const el = document.getElementById(href.slice(1))
        if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth' }) }
      }}
      {...props}
    >
      {children}
    </a>
  )
}
```

- [ ] **Step 9: Run the full suite**

```
npm test -- --run
```
Expected: `headingSlug` tests pass; previously-passing tests still pass; the known pre-existing failures unchanged. No new failures.

- [ ] **Step 10: Manual smoke test**

```
npm run dev
```
- In a master doc, write a couple of `# Headings`. Type `[[#` → autocomplete lists the headings → pick one → inserts `[Heading](#heading-slug)`.
- Switch the doc to rendered → the inserted link is clickable and smooth-scrolls to that heading.
- `[[` (no `#`) still completes entries as before.

- [ ] **Step 11: Commit**

```
git add src/lib/headingSlug.js src/lib/headingSlug.test.js src/lib/entryAutocomplete.js src/components/TopicDocEditor.jsx src/components/MarkdownView.jsx package.json package-lock.json
git commit -m "feat: [[# heading references with anchor navigation"
```
