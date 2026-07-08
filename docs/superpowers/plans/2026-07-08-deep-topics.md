# Deep Topics MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "deep topics" — a second kind of topic for reading *through* one big resource chapter-by-chapter with takeaway-first notes — reusing the existing `topics`/`entries` tables.

**Architecture:** A `kind` flag on `topics` (`'note'` default vs `'deep'`) selects the renderer, leaving the breadth-first Keep grid untouched. A deep topic has a `source` (book/web/paper/pdf), an ordered `resource_sections` outline, a cursor (`cursor_section_id`), and takeaway notes stored as `entries` (new `section_id`, `takeaway`, `parent_id` columns). Deep topics are hidden from the breadth topic list and shown in a new "Reading" view.

**Tech Stack:** React 18 (function components, hooks), Supabase (Postgres + RLS), Vite, Vitest + @testing-library/react, lucide-react icons. Reuses `PdfViewer`, reader `full_text`, and `uploadAttachment`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-08-deep-topics-design.md`.
- Reuse `entries`/`topics`; do NOT create a parallel problems/notes table.
- `source_kind` ∈ `'book' | 'web' | 'paper' | 'pdf'`; `'book'` = no digital file.
- Breadth topics (`kind = 'note'`) must be visually and behaviourally unchanged.
- Tests: Vitest, run with `npx vitest run <path>`. DB helpers use `src/test/mockSupabase.js`.
- Commit style: no `Co-Authored-By: Claude` trailer; codebase acknowledgment is fine. Conventional-commit prefixes (`feat:`, `test:`).
- Migrations are sequential SQL files under `supabase/migrations/`; next number is `0042`.
- Do NOT run `supabase db push` in these tasks — schema deploy is a manual step the user runs after review.

---

### Task 1: Migration — schema for deep topics

**Files:**
- Create: `supabase/migrations/0042_deep_topics.sql`

**Interfaces:**
- Produces: `topics.kind`, `topics.source_kind`, `topics.source_url`, `topics.cursor_section_id`; table `resource_sections(id, user_id, topic_id, position, title, status, created_at)`; `entries.section_id`, `entries.takeaway`, `entries.parent_id`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0042_deep_topics.sql`:

```sql
-- Deep topics: read *through* one big resource chapter-by-chapter with
-- takeaway-first notes. Reuses topics (kind flag + source) and entries
-- (takeaway notes), plus a resource_sections outline. See spec 2026-07-08.

-- 1. topics: kind + source (cursor_section_id added after the table exists)
alter table topics
  add column if not exists kind        text not null default 'note',
  add column if not exists source_kind text
    check (source_kind is null or source_kind in ('book', 'web', 'paper', 'pdf')),
  add column if not exists source_url  text;

-- 2. resource_sections: the ordered chapter outline
create table if not exists resource_sections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  topic_id   uuid not null references topics on delete cascade,
  position   int  not null,
  title      text not null,
  status     text not null default 'todo'
             check (status in ('todo', 'reading', 'done')),
  created_at timestamptz default now()
);

alter table resource_sections enable row level security;
create policy "resource_sections: own rows" on resource_sections
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists resource_sections_topic_id on resource_sections (topic_id);

-- 3. topics.cursor_section_id (FK now that resource_sections exists)
alter table topics
  add column if not exists cursor_section_id uuid
    references resource_sections(id) on delete set null;

-- 4. entries: takeaway-first note columns
alter table entries
  add column if not exists section_id uuid references resource_sections(id) on delete set null,
  add column if not exists takeaway   text,
  add column if not exists parent_id  uuid references entries(id) on delete set null;

create index if not exists entries_section_id on entries (section_id);
```

- [ ] **Step 2: Verify the SQL parses (dry lint)**

Run: `grep -c 'add column if not exists' supabase/migrations/0042_deep_topics.sql`
Expected: `7`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0042_deep_topics.sql
git commit -m "feat: migration for deep topics (kind, source, sections, takeaways)"
```

---

### Task 2: DB helpers — `deepTopics.js`

**Files:**
- Create: `src/lib/db/deepTopics.js`
- Test: `src/lib/db/deepTopics.test.js`

**Interfaces:**
- Consumes: `topics`/`entries`/`resource_sections` from Task 1.
- Produces:
  - `createDeepTopic(supabase, { name, source_kind, source_url = null }) → topic row`
  - `listDeepTopics(supabase) → topic[]` (kind='deep', not deleted, ordered by name)
  - `getDeepTopic(supabase, topicId) → { topic, sections, takeaways }`
  - `addSection(supabase, { topicId, title, position }) → section row`
  - `setCursor(supabase, topicId, sectionId) → void`
  - `setSectionStatus(supabase, sectionId, status) → void`
  - `addTakeaway(supabase, { topicId, sectionId, takeaway, note = '', parentId = null }) → entry row`
  - `updateTakeaway(supabase, id, patch) → void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/db/deepTopics.test.js`:

```js
import { describe, test, expect } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase.js'
import {
  createDeepTopic, listDeepTopics, addSection, setCursor,
  setSectionStatus, addTakeaway, updateTakeaway,
} from './deepTopics.js'

// mockSupabase resolves auth.getUser via a stub we add per test.
function withUser(result) {
  const sb = mockSupabase(result)
  sb.auth = { getUser: async () => ({ data: { user: { id: 'u1' } } }) }
  return sb
}

describe('deepTopics db', () => {
  test('createDeepTopic inserts kind=deep with source', async () => {
    const row = { id: 't1', name: 'Trading & Exchanges', kind: 'deep' }
    const sb = withUser({ data: row, error: null })
    const out = await createDeepTopic(sb, { name: 'Trading & Exchanges', source_kind: 'book' })
    expect(sb.from).toHaveBeenCalledWith('topics')
    expect(sb._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', name: 'Trading & Exchanges', kind: 'deep', source_kind: 'book', source_url: null }),
    )
    expect(out).toEqual(row)
  })

  test('listDeepTopics filters kind=deep and non-deleted', async () => {
    const sb = mockSupabase({ data: [{ id: 't1', kind: 'deep' }], error: null })
    const out = await listDeepTopics(sb)
    expect(sb._chain.eq).toHaveBeenCalledWith('kind', 'deep')
    expect(sb._chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(out).toHaveLength(1)
  })

  test('addSection inserts at the given position', async () => {
    const row = { id: 's1', title: 'Ch.1', position: 3 }
    const sb = withUser({ data: row, error: null })
    const out = await addSection(sb, { topicId: 't1', title: 'Ch.1', position: 3 })
    expect(sb.from).toHaveBeenCalledWith('resource_sections')
    expect(sb._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', topic_id: 't1', title: 'Ch.1', position: 3 }),
    )
    expect(out).toEqual(row)
  })

  test('setCursor updates the topic', async () => {
    const sb = mockSupabase({ data: null, error: null })
    await setCursor(sb, 't1', 's2')
    expect(sb.from).toHaveBeenCalledWith('topics')
    expect(sb._chain.update).toHaveBeenCalledWith({ cursor_section_id: 's2' })
    expect(sb._chain.eq).toHaveBeenCalledWith('id', 't1')
  })

  test('setSectionStatus updates the section', async () => {
    const sb = mockSupabase({ data: null, error: null })
    await setSectionStatus(sb, 's1', 'done')
    expect(sb._chain.update).toHaveBeenCalledWith({ status: 'done' })
    expect(sb._chain.eq).toHaveBeenCalledWith('id', 's1')
  })

  test('addTakeaway inserts an entry with takeaway + section', async () => {
    const row = { id: 'e1', takeaway: 'spread = adverse-selection comp' }
    const sb = withUser({ data: row, error: null })
    const out = await addTakeaway(sb, { topicId: 't1', sectionId: 's1', takeaway: 'spread = adverse-selection comp', note: 'p.42' })
    expect(sb.from).toHaveBeenCalledWith('entries')
    expect(sb._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', topic_id: 't1', section_id: 's1', takeaway: 'spread = adverse-selection comp', note: 'p.42', parent_id: null }),
    )
    expect(out).toEqual(row)
  })

  test('addTakeaway carries parentId for a tangent', async () => {
    const sb = withUser({ data: { id: 'e2' }, error: null })
    await addTakeaway(sb, { topicId: 't1', sectionId: 's1', takeaway: 'x', parentId: 'e1' })
    expect(sb._chain.insert).toHaveBeenCalledWith(expect.objectContaining({ parent_id: 'e1' }))
  })

  test('updateTakeaway patches the entry', async () => {
    const sb = mockSupabase({ data: null, error: null })
    await updateTakeaway(sb, 'e1', { takeaway: 'edited' })
    expect(sb._chain.update).toHaveBeenCalledWith({ takeaway: 'edited' })
    expect(sb._chain.eq).toHaveBeenCalledWith('id', 'e1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/deepTopics.test.js`
Expected: FAIL — `Cannot find module './deepTopics.js'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/db/deepTopics.js`:

```js
// DB helpers for deep topics: pattern of createFeed/createEntry (auth.getUser
// for user_id, throw on error). Takeaway notes reuse the entries table.

export async function createDeepTopic(supabase, { name, source_kind, source_url = null }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('topics')
    .insert({ user_id: user.id, name, kind: 'deep', source_kind, source_url })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function listDeepTopics(supabase) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('kind', 'deep')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

// Loads a deep topic with its ordered sections and takeaway entries.
export async function getDeepTopic(supabase, topicId) {
  const [topicRes, sectionsRes, takeawaysRes] = await Promise.all([
    supabase.from('topics').select('*').eq('id', topicId).single(),
    supabase.from('resource_sections').select('*').eq('topic_id', topicId).order('position', { ascending: true }),
    supabase.from('entries').select('id, topic_id, section_id, takeaway, note, parent_id, created_at')
      .eq('topic_id', topicId).is('deleted_at', null).order('created_at', { ascending: true }),
  ])
  if (topicRes.error) throw new Error(topicRes.error.message)
  return {
    topic: topicRes.data,
    sections: sectionsRes.data ?? [],
    takeaways: takeawaysRes.data ?? [],
  }
}

export async function addSection(supabase, { topicId, title, position }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('resource_sections')
    .insert({ user_id: user.id, topic_id: topicId, title, position })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function setCursor(supabase, topicId, sectionId) {
  const { error } = await supabase.from('topics').update({ cursor_section_id: sectionId }).eq('id', topicId)
  if (error) throw new Error(error.message)
}

export async function setSectionStatus(supabase, sectionId, status) {
  const { error } = await supabase.from('resource_sections').update({ status }).eq('id', sectionId)
  if (error) throw new Error(error.message)
}

export async function addTakeaway(supabase, { topicId, sectionId, takeaway, note = '', parentId = null }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: user.id, topic_id: topicId, section_id: sectionId, takeaway, note, parent_id: parentId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTakeaway(supabase, id, patch) {
  const { error } = await supabase.from('entries').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/deepTopics.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/deepTopics.js src/lib/db/deepTopics.test.js
git commit -m "feat: deep topics db helpers (sections, cursor, takeaways)"
```

---

### Task 3: Hide deep topics from the breadth topic list

**Files:**
- Modify: `src/lib/db/topics.js` (the `listTopics` query)
- Test: `src/lib/db/topics.test.js` (add one assertion)

**Interfaces:**
- Consumes: `topics.kind` from Task 1.
- Produces: `listTopics` returns only `kind = 'note'` topics (breadth grid unaffected by deep topics).

- [ ] **Step 1: Write the failing test**

In `src/lib/db/topics.test.js`, inside the `describe('topic lifecycle', ...)` block that uses `makeChain`, add:

```js
  test('listTopics filters kind = note (excludes deep topics)', async () => {
    const chain = makeChain({ data: [{ id: 't1', name: 'AI', entries: [{ count: 1 }] }], error: null })
    const sb = { from: vi.fn(() => chain) }
    await listTopics(sb)
    expect(chain.eq).toHaveBeenCalledWith('kind', 'note')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/topics.test.js`
Expected: FAIL — `chain.eq` not called with `('kind', 'note')`

- [ ] **Step 3: Add the filter**

In `src/lib/db/topics.js`, in `listTopics`, add `.eq('kind', 'note')` immediately after the existing `.is('pattern_target', null)` line:

```js
    .is('deleted_at', null)
    .is('pattern_target', null) // interview pattern-topics live in their own view
    .eq('kind', 'note')         // deep topics live in the Reading view
    .order('name', { ascending: true })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/topics.test.js`
Expected: PASS (all existing + the new one)

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/topics.js src/lib/db/topics.test.js
git commit -m "feat: exclude deep topics from breadth topic list"
```

---

### Task 4: `ReadingView` — list deep topics + create one

**Files:**
- Create: `src/components/ReadingView.jsx`
- Test: `src/components/ReadingView.test.jsx`
- Modify: `src/styles.css` (append the `.rd-*` block shown in Step 5)

**Interfaces:**
- Consumes: `listDeepTopics`, `createDeepTopic` (Task 2); `uploadAttachment` from `src/lib/storage.js` (existing, returns `{ url, thumbUrl }`).
- Produces: `<ReadingView supabase onOpenTopic addToast />` — `onOpenTopic(topicId)` is called when a resource is clicked (Task 7 wires it to open `DeepTopicView`).

- [ ] **Step 1: Write the failing test**

Create `src/components/ReadingView.test.jsx`:

```jsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import ReadingView from './ReadingView.jsx'

vi.mock('../lib/db/deepTopics.js', () => ({
  listDeepTopics: vi.fn(async () => [
    { id: 't1', name: 'Trading & Exchanges', source_kind: 'book' },
  ]),
  createDeepTopic: vi.fn(async ({ name }) => ({ id: 't2', name, source_kind: 'web' })),
}))

beforeEach(() => vi.clearAllMocks())

test('lists existing deep topics', async () => {
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  expect(await screen.findByText('Trading & Exchanges')).toBeTruthy()
})

test('opens a topic when clicked', async () => {
  const onOpen = vi.fn()
  render(<ReadingView supabase={{}} onOpenTopic={onOpen} addToast={vi.fn()} />)
  fireEvent.click(await screen.findByText('Trading & Exchanges'))
  expect(onOpen).toHaveBeenCalledWith('t1')
})

test('creates a book resource from the form', async () => {
  const { createDeepTopic } = await import('../lib/db/deepTopics.js')
  render(<ReadingView supabase={{}} onOpenTopic={vi.fn()} addToast={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /new resource/i }))
  fireEvent.change(screen.getByPlaceholderText(/name/i), { target: { value: 'The Rust Book' } })
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
  await waitFor(() => expect(createDeepTopic).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'The Rust Book' }),
  ))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ReadingView.test.jsx`
Expected: FAIL — `Cannot find module './ReadingView.jsx'`

- [ ] **Step 3: Write the component**

Create `src/components/ReadingView.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { BookOpen, Plus } from 'lucide-react'
import { listDeepTopics, createDeepTopic } from '../lib/db/deepTopics.js'
import { uploadAttachment } from '../lib/storage.js'

const SOURCE_KINDS = [
  { key: 'book', label: 'Book (no file)' },
  { key: 'web', label: 'Web article' },
  { key: 'paper', label: 'Paper (URL)' },
  { key: 'pdf', label: 'PDF upload' },
]

export default function ReadingView({ supabase, onOpenTopic, addToast }) {
  const [topics, setTopics] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [sourceKind, setSourceKind] = useState('book')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try { setTopics(await listDeepTopics(supabase)) }
    catch (e) { addToast?.(e.message, 'error'); setTopics([]) }
  }
  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      let source_url = null
      if (sourceKind === 'web' || sourceKind === 'paper') source_url = url.trim() || null
      if (sourceKind === 'pdf') {
        if (!file) { addToast?.('Choose a PDF first', 'error'); setBusy(false); return }
        const up = await uploadAttachment(supabase, file)
        source_url = up.url
      }
      const created = await createDeepTopic(supabase, { name: name.trim(), source_kind: sourceKind, source_url })
      setName(''); setUrl(''); setFile(null); setShowAdd(false)
      await load()
      onOpenTopic?.(created.id)
    } catch (e) { addToast?.(e.message, 'error') }
    setBusy(false)
  }

  return (
    <div className="rd-view">
      <div className="rd-header">
        <h2 className="rd-title"><BookOpen size={20} /> reading</h2>
        <button className="rd-add-btn" onClick={() => setShowAdd((v) => !v)}>
          <Plus size={14} /> new resource
        </button>
      </div>

      {showAdd && (
        <div className="rd-add-form">
          <input placeholder="name (e.g. Trading & Exchanges)" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={sourceKind} onChange={(e) => setSourceKind(e.target.value)}>
            {SOURCE_KINDS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {(sourceKind === 'web' || sourceKind === 'paper') && (
            <input placeholder="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          )}
          {sourceKind === 'pdf' && (
            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          )}
          <div className="rd-add-actions">
            <button onClick={handleCreate} disabled={busy || !name.trim()}>{busy ? 'adding…' : 'add'}</button>
            <button onClick={() => setShowAdd(false)}>cancel</button>
          </div>
        </div>
      )}

      {topics === null ? (
        <p className="muted">loading…</p>
      ) : topics.length === 0 ? (
        <p className="muted">No resources yet. Add a book, article, paper, or PDF to read through.</p>
      ) : (
        <div className="rd-grid">
          {topics.map((t) => (
            <button key={t.id} className="rd-card" onClick={() => onOpenTopic?.(t.id)}>
              <span className="rd-card-name">{t.name}</span>
              <span className="rd-card-kind">{t.source_kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ReadingView.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Append styles**

Append to `src/styles.css`:

```css
/* ── Reading (deep-topic list) ── */
.rd-view { max-width: 820px; margin: 0 auto; padding: 32px 24px 64px; }
.rd-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.rd-title { display: flex; align-items: center; gap: 8px; font-size: 1.2rem; margin: 0; }
.rd-add-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; font-size: var(--text-sm); color: var(--muted); cursor: pointer; }
.rd-add-btn:hover { color: var(--text); border-color: var(--accent); }
.rd-add-form { display: flex; flex-direction: column; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; margin-bottom: 20px; }
.rd-add-form input, .rd-add-form select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: var(--text-sm); }
.rd-add-actions { display: flex; gap: 8px; }
.rd-add-actions button { padding: 7px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); cursor: pointer; font-size: var(--text-sm); }
.rd-add-actions button:first-child { background: var(--accent); color: #fff; border-color: var(--accent); }
.rd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.rd-card { display: flex; flex-direction: column; gap: 8px; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 14px; cursor: pointer; transition: border-color 0.12s, box-shadow 0.12s; }
.rd-card:hover { border-color: color-mix(in srgb, var(--border) 50%, var(--accent) 50%); box-shadow: var(--shadow-card-hover); }
.rd-card-name { font-weight: 500; color: var(--text); }
.rd-card-kind { font-size: var(--text-xs); color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
```

- [ ] **Step 6: Run the test again (styles don't break it) and commit**

Run: `npx vitest run src/components/ReadingView.test.jsx`
Expected: PASS (3 tests)

```bash
git add src/components/ReadingView.jsx src/components/ReadingView.test.jsx src/styles.css
git commit -m "feat: ReadingView — list and create deep-topic resources"
```

---

### Task 5: `DeepTopicView` — outline, cursor, takeaway notes, tangents

**Files:**
- Create: `src/components/DeepTopicView.jsx`
- Test: `src/components/DeepTopicView.test.jsx`
- Modify: `src/styles.css` (append the `.dt-*` block shown in Step 5)

**Interfaces:**
- Consumes: `getDeepTopic`, `addSection`, `setCursor`, `addTakeaway` (Task 2). Renders `PdfViewer` (Task 6 adds the source pane; this task leaves a `<div className="dt-source" />` placeholder).
- Produces: `<DeepTopicView supabase topicId onBack addToast />`.

- [ ] **Step 1: Write the failing test**

Create `src/components/DeepTopicView.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import DeepTopicView from './DeepTopicView.jsx'

const state = {
  topic: { id: 't1', name: 'Trading & Exchanges', source_kind: 'book', source_url: null, cursor_section_id: 's1' },
  sections: [
    { id: 's1', title: 'Ch.1 Order books', position: 1, status: 'reading' },
    { id: 's2', title: 'Ch.2 Spread', position: 2, status: 'todo' },
  ],
  takeaways: [
    { id: 'e1', section_id: 's1', takeaway: 'price-time priority', note: '', parent_id: null },
  ],
}

vi.mock('../lib/db/deepTopics.js', () => ({
  getDeepTopic: vi.fn(async () => state),
  addSection: vi.fn(async ({ title, position }) => ({ id: 's3', title, position, status: 'todo' })),
  setCursor: vi.fn(async () => {}),
  setSectionStatus: vi.fn(async () => {}),
  addTakeaway: vi.fn(async ({ takeaway, sectionId }) => ({ id: 'e2', section_id: sectionId, takeaway, note: '', parent_id: null })),
  updateTakeaway: vi.fn(async () => {}),
}))

beforeEach(() => vi.clearAllMocks())

test('renders sections and the cursor takeaway', async () => {
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  expect(await screen.findByText('Ch.1 Order books')).toBeTruthy()
  expect(screen.getByText('price-time priority')).toBeTruthy()
})

test('adds a takeaway to the current section', async () => {
  const { addTakeaway } = await import('../lib/db/deepTopics.js')
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  await screen.findByText('Ch.1 Order books')
  fireEvent.change(screen.getByPlaceholderText(/takeaway/i), { target: { value: 'market vs limit' } })
  fireEvent.click(screen.getByRole('button', { name: /save takeaway/i }))
  await waitFor(() => expect(addTakeaway).toHaveBeenCalledWith(
    expect.objectContaining({ topicId: 't1', sectionId: 's1', takeaway: 'market vs limit' }),
  ))
})

test('adds a section and advances the cursor to it', async () => {
  const { addSection, setCursor } = await import('../lib/db/deepTopics.js')
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  await screen.findByText('Ch.1 Order books')
  fireEvent.change(screen.getByPlaceholderText(/add section/i), { target: { value: 'Ch.3 Inventory' } })
  fireEvent.click(screen.getByRole('button', { name: /^add section$/i }))
  await waitFor(() => expect(addSection).toHaveBeenCalledWith(
    expect.objectContaining({ topicId: 't1', title: 'Ch.3 Inventory', position: 3 }),
  ))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DeepTopicView.test.jsx`
Expected: FAIL — `Cannot find module './DeepTopicView.jsx'`

- [ ] **Step 3: Write the component**

Create `src/components/DeepTopicView.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, CornerDownRight } from 'lucide-react'
import { getDeepTopic, addSection, setCursor, setSectionStatus, addTakeaway } from '../lib/db/deepTopics.js'

export default function DeepTopicView({ supabase, topicId, onBack, addToast }) {
  const [data, setData] = useState(null)
  const [newSection, setNewSection] = useState('')
  const [takeaway, setTakeaway] = useState('')
  const [note, setNote] = useState('')
  const [tangentFor, setTangentFor] = useState(null) // parent entry id
  const [tab, setTab] = useState('read') // 'read' | 'learned'
  const [busy, setBusy] = useState(false)

  async function load() {
    try { setData(await getDeepTopic(supabase, topicId)) }
    catch (e) { addToast?.(e.message, 'error') }
  }
  useEffect(() => { load() }, [topicId])

  if (!data) return <div className="dt-view"><p className="muted">loading…</p></div>

  const { topic, sections, takeaways } = data
  const cursor = sections.find((s) => s.id === topic.cursor_section_id) || sections[0] || null
  const cursorTakeaways = cursor ? takeaways.filter((t) => t.section_id === cursor.id && !t.parent_id) : []
  const childrenOf = (id) => takeaways.filter((t) => t.parent_id === id)

  async function handleAddSection() {
    const title = newSection.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      const position = (sections.at(-1)?.position ?? 0) + 1
      const created = await addSection(supabase, { topicId, title, position })
      await setCursor(supabase, topicId, created.id)
      setNewSection('')
      await load()
    } catch (e) { addToast?.(e.message, 'error') }
    setBusy(false)
  }

  async function handleSelectSection(s) {
    try { await setCursor(supabase, topicId, s.id); await load() }
    catch (e) { addToast?.(e.message, 'error') }
  }

  async function handleAddTakeaway(parentId = null) {
    const tk = takeaway.trim()
    if (!tk || !cursor || busy) return
    setBusy(true)
    try {
      await addTakeaway(supabase, { topicId, sectionId: cursor.id, takeaway: tk, note: note.trim(), parentId })
      setTakeaway(''); setNote(''); setTangentFor(null)
      await load()
    } catch (e) { addToast?.(e.message, 'error') }
    setBusy(false)
  }

  async function handleMarkDone() {
    if (!cursor) return
    try { await setSectionStatus(supabase, cursor.id, 'done'); await load() }
    catch (e) { addToast?.(e.message, 'error') }
  }

  return (
    <div className="dt-view">
      <div className="dt-header">
        <button className="dt-back" onClick={onBack}><ArrowLeft size={16} /> reading</button>
        <h2 className="dt-title">{topic.name}</h2>
        <div className="dt-tabs">
          <button className={tab === 'read' ? 'active' : ''} onClick={() => setTab('read')}>read</button>
          <button className={tab === 'learned' ? 'active' : ''} onClick={() => setTab('learned')}>what I learned</button>
        </div>
      </div>

      <div className="dt-body">
        <div className="dt-source" />

        <div className="dt-main">
          {tab === 'read' ? (
            <>
              <div className="dt-outline">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    className={`dt-section ${s.id === cursor?.id ? 'current' : ''} dt-section--${s.status}`}
                    onClick={() => handleSelectSection(s)}
                  >
                    {s.title}
                  </button>
                ))}
                <div className="dt-add-section">
                  <input placeholder="add section…" value={newSection} onChange={(e) => setNewSection(e.target.value)} />
                  <button onClick={handleAddSection} disabled={busy || !newSection.trim()}>add section</button>
                </div>
              </div>

              {cursor ? (
                <div className="dt-current">
                  <div className="dt-current-head">
                    <span className="dt-current-title">{cursor.title}</span>
                    <button className="dt-done-btn" onClick={handleMarkDone}>mark section done</button>
                  </div>

                  <div className="dt-takeaways">
                    {cursorTakeaways.length === 0 && <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>no takeaways yet — write what you can use.</p>}
                    {cursorTakeaways.map((t) => (
                      <div key={t.id} className="dt-takeaway">
                        <p className="dt-takeaway-text">{t.takeaway}</p>
                        {t.note && <p className="dt-takeaway-note">{t.note}</p>}
                        {childrenOf(t.id).map((c) => (
                          <div key={c.id} className="dt-tangent">
                            <CornerDownRight size={12} />
                            <div><p className="dt-takeaway-text">{c.takeaway}</p>{c.note && <p className="dt-takeaway-note">{c.note}</p>}</div>
                          </div>
                        ))}
                        <button className="dt-tangent-btn" onClick={() => setTangentFor(tangentFor === t.id ? null : t.id)}>
                          {tangentFor === t.id ? 'cancel' : '+ tangent'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="dt-add-takeaway">
                    <input placeholder="takeaway — what can you use?" value={takeaway} onChange={(e) => setTakeaway(e.target.value)} />
                    <input placeholder="summary / quote (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                    <button onClick={() => handleAddTakeaway(tangentFor)} disabled={busy || !takeaway.trim()}>
                      {tangentFor ? 'save tangent' : 'save takeaway'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="muted">Add the first section to start.</p>
              )}
            </>
          ) : (
            <div className="dt-learned">
              {sections.map((s) => {
                const items = takeaways.filter((t) => t.section_id === s.id)
                if (!items.length) return null
                return (
                  <div key={s.id} className="dt-learned-section">
                    <p className="dt-learned-title">{s.title}</p>
                    {items.map((t) => (
                      <p key={t.id} className={`dt-learned-item ${t.parent_id ? 'child' : ''}`}>{t.takeaway}</p>
                    ))}
                  </div>
                )
              })}
              {takeaways.length === 0 && <p className="muted">Nothing yet — your takeaways will collect here.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DeepTopicView.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Append styles**

Append to `src/styles.css`:

```css
/* ── Deep topic reader ── */
.dt-view { max-width: 1100px; margin: 0 auto; padding: 24px; }
.dt-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.dt-back { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: var(--muted); cursor: pointer; font-size: var(--text-sm); }
.dt-back:hover { color: var(--text); }
.dt-title { font-size: 1.15rem; margin: 0; flex: 1; }
.dt-tabs { display: flex; gap: 4px; }
.dt-tabs button { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; font-size: var(--text-sm); color: var(--muted); cursor: pointer; }
.dt-tabs button.active { background: var(--accent-weak); color: var(--accent); border-color: var(--accent); }
.dt-body { display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px; }
.dt-source:empty { display: none; }
.dt-main { min-width: 0; }
.dt-outline { display: flex; flex-direction: column; gap: 3px; margin-bottom: 20px; }
.dt-section { text-align: left; background: none; border: none; border-left: 2px solid transparent; padding: 6px 10px; border-radius: 4px; color: var(--muted); cursor: pointer; font-size: var(--text-sm); }
.dt-section:hover { background: var(--surface-2); }
.dt-section.current { color: var(--text); border-left-color: var(--accent); background: var(--accent-weak); font-weight: 500; }
.dt-section--done { text-decoration: line-through; opacity: 0.6; }
.dt-add-section { display: flex; gap: 6px; margin-top: 6px; }
.dt-add-section input { flex: 1; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: var(--text-sm); }
.dt-add-section button, .dt-add-takeaway button, .dt-done-btn { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--accent); background: var(--accent); color: #fff; cursor: pointer; font-size: var(--text-sm); }
.dt-current-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.dt-current-title { font-weight: 600; font-size: var(--text-base); }
.dt-done-btn { background: none; color: var(--muted); border-color: var(--border); }
.dt-takeaway { border-left: 2px solid var(--accent); padding: 4px 0 4px 12px; margin-bottom: 12px; }
.dt-takeaway-text { margin: 0; font-size: var(--text-base); color: var(--text); }
.dt-takeaway-note { margin: 4px 0 0; font-size: var(--text-sm); color: var(--muted); }
.dt-tangent { display: flex; gap: 6px; margin: 8px 0 0 12px; color: var(--muted); }
.dt-tangent-btn { background: none; border: none; color: var(--muted); font-size: var(--text-xs); cursor: pointer; padding: 4px 0; }
.dt-tangent-btn:hover { color: var(--accent); }
.dt-add-takeaway { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
.dt-add-takeaway input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: var(--text-sm); }
.dt-learned-section { margin-bottom: 18px; }
.dt-learned-title { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin: 0 0 6px; }
.dt-learned-item { margin: 0 0 6px; font-size: var(--text-base); color: var(--text); }
.dt-learned-item.child { margin-left: 16px; color: var(--muted); font-size: var(--text-sm); }
@media (max-width: 720px) { .dt-body { grid-template-columns: 1fr; } }
```

- [ ] **Step 6: Run the test again and commit**

Run: `npx vitest run src/components/DeepTopicView.test.jsx`
Expected: PASS (3 tests)

```bash
git add src/components/DeepTopicView.jsx src/components/DeepTopicView.test.jsx src/styles.css
git commit -m "feat: DeepTopicView — outline, cursor, takeaway notes, tangents"
```

---

### Task 6: Source pane — web reader / PDF viewer / book

**Files:**
- Modify: `src/components/DeepTopicView.jsx` (replace the `<div className="dt-source" />` placeholder)
- Test: `src/components/DeepTopicView.test.jsx` (add two assertions)

**Interfaces:**
- Consumes: existing `PdfViewer` (`src/components/PdfViewer.jsx`, prop `url`). `topic.source_kind` / `topic.source_url` from Task 1.
- Produces: source pane renders a PDF for `pdf`, a link-to-open for `web`/`paper`, nothing for `book`.

- [ ] **Step 1: Write the failing test**

In `src/components/DeepTopicView.test.jsx`, mock `PdfViewer` at the top (after the existing `vi.mock`), and add two tests:

```jsx
vi.mock('./PdfViewer.jsx', () => ({ default: ({ url }) => <div data-testid="pdf">{url}</div> }))

test('renders a PDF source pane for pdf resources', async () => {
  const { getDeepTopic } = await import('../lib/db/deepTopics.js')
  getDeepTopic.mockResolvedValueOnce({
    ...state,
    topic: { ...state.topic, source_kind: 'pdf', source_url: 'https://x/f.pdf' },
  })
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  expect(await screen.findByTestId('pdf')).toHaveTextContent('https://x/f.pdf')
})

test('renders an open-source link for web resources', async () => {
  const { getDeepTopic } = await import('../lib/db/deepTopics.js')
  getDeepTopic.mockResolvedValueOnce({
    ...state,
    topic: { ...state.topic, source_kind: 'web', source_url: 'https://example.com/a' },
  })
  render(<DeepTopicView supabase={{}} topicId="t1" onBack={vi.fn()} addToast={vi.fn()} />)
  expect(await screen.findByRole('link', { name: /open source/i })).toHaveAttribute('href', 'https://example.com/a')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DeepTopicView.test.jsx`
Expected: FAIL — no `pdf` testid / no "open source" link

- [ ] **Step 3: Implement the source pane**

In `src/components/DeepTopicView.jsx`, add the import at the top:

```jsx
import PdfViewer from './PdfViewer.jsx'
```

Replace `<div className="dt-source" />` with:

```jsx
        <div className="dt-source">
          {topic.source_kind === 'pdf' && topic.source_url && <PdfViewer url={topic.source_url} />}
          {(topic.source_kind === 'web' || topic.source_kind === 'paper') && topic.source_url && (
            <a className="dt-source-link" href={topic.source_url} target="_blank" rel="noreferrer">open source ↗</a>
          )}
        </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DeepTopicView.test.jsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Add the link style and commit**

Append to `src/styles.css`:

```css
.dt-source-link { display: inline-block; font-size: var(--text-sm); color: var(--accent); padding: 8px 0; }
```

```bash
git add src/components/DeepTopicView.jsx src/components/DeepTopicView.test.jsx src/styles.css
git commit -m "feat: deep-topic source pane (pdf viewer / web link / book)"
```

---

### Task 7: Wire the Reading nav item + routing in App.jsx

**Files:**
- Modify: `src/components/NavSidebar.jsx` (icon import + a nav item in the `library` section)
- Modify: `src/App.jsx` (lazy import, a `deepTopicId` state, and two `view ===` blocks)

**Interfaces:**
- Consumes: `ReadingView` (Task 4), `DeepTopicView` (Task 5/6).
- Produces: a "Reading" sidebar item → `view='reading'` renders `ReadingView`; clicking a resource sets `deepTopicId` and switches to `view='deeptopic'` rendering `DeepTopicView`.

- [ ] **Step 1: Add the nav item**

In `src/components/NavSidebar.jsx`, add `BookMarked` to the `lucide-react` import line, then add this item as the first entry of the `library` section's `items` array (just before `{ view: 'highlights', … }`):

```jsx
      { view: 'reading', label: 'Reading', icon: BookMarked },
```

- [ ] **Step 2: Lazy-import the views in App.jsx**

In `src/App.jsx`, next to the other `lazy(() => import(...))` view imports (near `TidyView`/`InterviewView`), add:

```jsx
const ReadingView = lazy(() => import('./components/ReadingView.jsx'))
const DeepTopicView = lazy(() => import('./components/DeepTopicView.jsx'))
```

- [ ] **Step 3: Add routing state**

In `src/App.jsx`, next to the `const [view, setView] = useState('home')` line, add:

```jsx
  const [deepTopicId, setDeepTopicId] = useState(null)
```

- [ ] **Step 4: Add the two view blocks**

In `src/App.jsx`, next to the `{view === 'interview' && (...)}` block, add:

```jsx
          {view === 'reading' && (
            <ReadingView
              supabase={supabase}
              addToast={addToast}
              onOpenTopic={(id) => { setDeepTopicId(id); setView('deeptopic') }}
            />
          )}
          {view === 'deeptopic' && deepTopicId && (
            <DeepTopicView
              supabase={supabase}
              topicId={deepTopicId}
              addToast={addToast}
              onBack={() => setView('reading')}
            />
          )}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: `✓ built` with no errors; a `ReadingView-*.js` and `DeepTopicView-*.js` chunk emitted.

- [ ] **Step 6: Run the full affected test set**

Run: `npx vitest run src/components/ReadingView.test.jsx src/components/DeepTopicView.test.jsx src/lib/db/deepTopics.test.js src/lib/db/topics.test.js`
Expected: PASS (all)

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/NavSidebar.jsx
git commit -m "feat: wire Reading + deep-topic views into nav and routing"
```

---

## Post-plan manual steps (user runs these)

1. `npx supabase db push` — apply `0042_deep_topics.sql` to the linked project.
2. Open the app → **Reading** → **new resource** → add a book (e.g. "Trading & Exchanges"), then read through it: add a section, write a takeaway, advance the cursor.

## Deferred to later specs (do NOT build here)

- The Gains "when bored" feed (Spec 2) — one-at-a-time pull across active resources.
- Phase B: AI/algorithmic section auto-suggest from PDF TOC / web headings.
- Phase C: AI-gathered resources.
- Interview-tracker absorption + unified Gains home.
