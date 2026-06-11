# MediaLog Plan 3 — Progress, Markdown, Tags, Revisit & Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the spec's feature set — consumption status + per-topic progress view, markdown note rendering with checkboxes, tags (incl. media-kind), a Revisit anti-rot feed, and plain-text markdown export.

**Architecture:** Extends the existing React/Supabase app. Tags use the existing `tags`/`entry_tags` tables, read via a nested Supabase select so each entry carries a `tags: string[]`. Status uses the existing `entries.status` column. Markdown renders via `react-markdown` + `remark-gfm`. Export builds one markdown file per topic (pure, testable function) zipped with `jszip` and downloaded client-side. New sidebar nav links: Revisit, Progress, Export.

**Tech Stack:** Existing + `react-markdown`, `remark-gfm`, `jszip`.

**Scope note:** Plan 3 of 3, final feature plan. After this, a dedicated visual/design pass styles the complete app (deferred per user decision). Honors every deliberate design choice: buckets-as-pillar (tags/status/calendar are auxiliary attributes of entries, never new top-level structure), flat topics + tags, status as a record not a TODO, plain-text ownership via export.

**Source spec:** `docs/superpowers/specs/2026-06-07-medialog-design.md`

**Prerequisite:** Plans 1 and 2 merged (or this branches off Plan 2's branch). Existing data layer: `topics.js` (`listTopics, createTopic, getTopicByName`), `entries.js` (`listEntriesByTopic, createEntry, updateEntry, deleteEntry, searchEntries, bulkCreateEntries`).

---

## File Structure

```
src/lib/db/tags.js                 — getOrCreateTag, setEntryTags, listTags
src/lib/db/tags.test.js
src/lib/db/entries.js              — MODIFY: nested tag select; add listForRevisit, markSurfaced
src/lib/db/entries.test.js         — MODIFY: update select assertions; add new tests
src/lib/exportMarkdown.js          — pure: entries+topics -> { 'Topic.md': string }
src/lib/exportMarkdown.test.js
src/lib/buildZip.js                — jszip wrapper: files map -> Blob (thin, no unit test)
src/components/EntryCard.jsx       — MODIFY: markdown render, status control, tag chips
src/components/EntryCard.test.jsx  — MODIFY: add status + markdown + tags assertions
src/components/TagInput.jsx        — comma/enter tag editor
src/components/TagInput.test.jsx
src/components/ProgressView.jsx    — per-topic counts by status
src/components/ProgressView.test.jsx
src/components/Revisit.jsx         — least-recently-seen feed, mark-seen advances
src/components/Revisit.test.jsx
src/App.jsx                        — MODIFY: wire tags, status, progress, revisit, export, nav
package.json                       — MODIFY: add react-markdown, remark-gfm, jszip
```

---

## Task 1: Add dependencies

**Files:** Modify `package.json`

- [ ] **Step 1: Install**

Run: `npm install react-markdown remark-gfm jszip`
Expected: adds the three packages to `dependencies`.

- [ ] **Step 2: Verify suite still green**

Run: `npm test`
Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown, remark-gfm, jszip"
```

---

## Task 2: Tags data layer (TDD)

**Files:** Create `src/lib/db/tags.js`, `src/lib/db/tags.test.js`

- [ ] **Step 1: Write failing test `src/lib/db/tags.test.js`**

```js
import { describe, test, expect, vi } from 'vitest'
import { getOrCreateTag, setEntryTags, listTags } from './tags.js'

function mockClient(result) {
  const chain = {
    select: vi.fn(() => Object.assign(Promise.resolve(result), chain)),
    insert: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => Object.assign(Promise.resolve(result), chain)),
    order: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}

describe('tags db', () => {
  test('getOrCreateTag upserts by name and returns the row', async () => {
    const row = { id: 't1', name: 'book' }
    const client = mockClient({ data: row, error: null })
    const result = await getOrCreateTag(client, 'book')
    expect(client._chain.upsert).toHaveBeenCalledWith({ name: 'book' }, { onConflict: 'user_id,name' })
    expect(result).toEqual(row)
  })

  test('listTags returns all tag names ordered', async () => {
    const rows = [{ id: 't1', name: 'ai' }, { id: 't2', name: 'book' }]
    const client = mockClient({ data: rows, error: null })
    const result = await listTags(client)
    expect(client.from).toHaveBeenCalledWith('tags')
    expect(result).toEqual(rows)
  })

  test('setEntryTags clears then links the given tags', async () => {
    const client = mockClient({ data: { id: 't1', name: 'book' }, error: null })
    await setEntryTags(client, 'e1', ['book'])
    // deletes existing links for the entry
    expect(client._chain.delete).toHaveBeenCalled()
    expect(client._chain.eq).toHaveBeenCalledWith('entry_id', 'e1')
    // inserts the new link
    expect(client._chain.insert).toHaveBeenCalledWith([{ entry_id: 'e1', tag_id: 't1' }])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tags`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/db/tags.js`**

```js
export async function getOrCreateTag(supabase, name) {
  const { data, error } = await supabase
    .from('tags')
    .upsert({ name }, { onConflict: 'user_id,name' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function listTags(supabase) {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

// Replace all of an entry's tag links with the given tag names.
export async function setEntryTags(supabase, entryId, names) {
  const { error: delErr } = await supabase.from('entry_tags').delete().eq('entry_id', entryId)
  if (delErr) throw new Error(delErr.message)
  if (names.length === 0) return
  const links = []
  for (const name of names) {
    const tag = await getOrCreateTag(supabase, name)
    links.push({ entry_id: entryId, tag_id: tag.id })
  }
  const { error: insErr } = await supabase.from('entry_tags').insert(links)
  if (insErr) throw new Error(insErr.message)
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- tags`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/tags.js src/lib/db/tags.test.js
git commit -m "feat: add tags data layer"
```

---

## Task 3: Entries carry tags + Revisit queries (TDD)

**Files:** Modify `src/lib/db/entries.js`, `src/lib/db/entries.test.js`

Change reads so each entry includes a flat `tags: string[]`, and add Revisit queries.

- [ ] **Step 1: Update `src/lib/db/entries.test.js`**

Add `listForRevisit, markSurfaced` to the import. Update the `listEntriesByTopic` test's select assertion and add a mapping assertion. Replace the existing `listEntriesByTopic` test with:
```js
  test('listEntriesByTopic selects nested tags and flattens them', async () => {
    const raw = [{ id: 'a', note: 'hi', entry_tags: [{ tags: { name: 'book' } }] }]
    const client = mockClient({ data: raw, error: null })
    const result = await listEntriesByTopic(client, 'topic-1')
    expect(client.from).toHaveBeenCalledWith('entries')
    expect(client._chain.select).toHaveBeenCalledWith('*, entry_tags(tags(name))')
    expect(client._chain.eq).toHaveBeenCalledWith('topic_id', 'topic-1')
    expect(result).toEqual([{ id: 'a', note: 'hi', tags: ['book'] }])
  })
```
Add new tests inside the describe block:
```js
  test('listForRevisit orders by last_surfaced_at nulls first', async () => {
    const raw = [{ id: 'a', note: 'x', entry_tags: [] }]
    const client = mockClient({ data: raw, error: null })
    const result = await listForRevisit(client, 5)
    expect(client._chain.order).toHaveBeenCalledWith('last_surfaced_at', {
      ascending: true, nullsFirst: true,
    })
    expect(client._chain.limit).toHaveBeenCalledWith(5)
    expect(result).toEqual([{ id: 'a', note: 'x', tags: [] }])
  })

  test('markSurfaced sets last_surfaced_at on the entry', async () => {
    const client = mockClient({ data: null, error: null })
    await markSurfaced(client, 'e1')
    expect(client._chain.update).toHaveBeenCalled()
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'e1')
  })
```
Update the `mockClient` in `entries.test.js` to add `limit` (chainable + terminal) and ensure `order` can be followed by `limit`. Replace the mock with:
```js
function mockClient(result) {
  const chain = {
    select: vi.fn(() => Object.assign(Promise.resolve(result), chain)),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => Object.assign(Promise.resolve(result), chain)),
    or: vi.fn(() => chain),
    order: vi.fn(() => Object.assign(Promise.resolve(result), chain)),
    limit: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}
```
Note: `searchEntries` test asserts `.or(...)` then `.order(...)`. With `order` now returning a thenable+chain, awaiting it still resolves `result`. The `createEntry`/`updateEntry` tests use `.select().single()` — still valid. Keep those tests as-is but if `listEntriesByTopic`/`searchEntries` previously asserted `select('*')`, update `searchEntries` test's select assertion to `'*, entry_tags(tags(name))'` as well (see Step 3).

- [ ] **Step 2: Run test, verify failures**

Run: `npm test -- entries`
Expected: FAIL on the updated/added tests.

- [ ] **Step 3: Update `src/lib/db/entries.js`**

Add a shared mapper and update reads. Replace `listEntriesByTopic` and `searchEntries`, and add the two new functions:
```js
const TAG_SELECT = '*, entry_tags(tags(name))'

function flattenTags(row) {
  const tags = (row.entry_tags || []).map((et) => et.tags?.name).filter(Boolean)
  const { entry_tags, ...rest } = row
  return { ...rest, tags }
}

export async function listEntriesByTopic(supabase, topicId) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function searchEntries(supabase, query) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .or(`note.ilike.%${query}%,title.ilike.%${query}%`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function listForRevisit(supabase, limit) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .order('last_surfaced_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}

export async function markSurfaced(supabase, id) {
  const { error } = await supabase
    .from('entries')
    .update({ last_surfaced_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
```
Also update the `searchEntries` test's select assertion to expect `TAG_SELECT` (`'*, entry_tags(tags(name))'`) if it asserted `'*'` before.

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- entries`
Expected: PASS (existing + 2 new; listEntriesByTopic + searchEntries updated).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/entries.js src/lib/db/entries.test.js
git commit -m "feat: entries carry flattened tags; add revisit queries"
```

---

## Task 4: EntryCard — markdown, status, tag chips (TDD)

**Files:** Modify `src/components/EntryCard.jsx`, `src/components/EntryCard.test.jsx`

- [ ] **Step 1: Update `src/components/EntryCard.test.jsx`** (replace file)

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './EntryCard.jsx'

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my **takeaway**', status: null, tags: [] }

test('renders title link and markdown note', () => {
  render(<EntryCard entry={base} onDelete={() => {}} onStatusChange={() => {}} />)
  expect(screen.getByRole('link', { name: 'A Site' })).toHaveAttribute('href', 'http://a.com')
  expect(screen.getByText('takeaway').tagName).toBe('STRONG') // markdown bold rendered
})

test('falls back to raw url when no title', () => {
  render(<EntryCard entry={{ ...base, title: null }} onDelete={() => {}} onStatusChange={() => {}} />)
  expect(screen.getByRole('link', { name: 'http://a.com' })).toBeInTheDocument()
})

test('shows tag chips', () => {
  render(<EntryCard entry={{ ...base, tags: ['book', 'ai'] }} onDelete={() => {}} onStatusChange={() => {}} />)
  expect(screen.getByText('#book')).toBeInTheDocument()
  expect(screen.getByText('#ai')).toBeInTheDocument()
})

test('changes status via selector', async () => {
  const onStatusChange = vi.fn()
  render(<EntryCard entry={base} onDelete={() => {}} onStatusChange={onStatusChange} />)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})

test('fires delete', async () => {
  const onDelete = vi.fn()
  render(<EntryCard entry={base} onDelete={onDelete} onStatusChange={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- EntryCard`
Expected: FAIL.

- [ ] **Step 3: Update `src/components/EntryCard.jsx`** (replace file)

```jsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const STATUSES = ['', 'backlog', 'active', 'done']

export default function EntryCard({ entry, onDelete, onStatusChange }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer">
          {entry.title || entry.url}
        </a>
      )}
      {entry.note && (
        <div className="note">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.note}</ReactMarkdown>
        </div>
      )}
      {entry.tags && entry.tags.length > 0 && (
        <div>
          {entry.tags.map((t) => (
            <span key={t} style={{ marginRight: 6, fontSize: 12, opacity: 0.7 }}>#{t}</span>
          ))}
        </div>
      )}
      <select
        value={entry.status || ''}
        onChange={(e) => onStatusChange(entry.id, e.target.value || null)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s === '' ? 'no status' : s}</option>
        ))}
      </select>
      <button onClick={() => onDelete(entry.id)} aria-label="delete">🗑</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- EntryCard`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/EntryCard.jsx src/components/EntryCard.test.jsx
git commit -m "feat: markdown render, status selector, and tag chips on entry cards"
```

---

## Task 5: TagInput component (TDD)

**Files:** Create `src/components/TagInput.jsx`, `src/components/TagInput.test.jsx`

- [ ] **Step 1: Write `src/components/TagInput.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import TagInput from './TagInput.jsx'

test('adds a tag on Enter and calls onChange', async () => {
  const onChange = vi.fn()
  render(<TagInput value={[]} onChange={onChange} />)
  await userEvent.type(screen.getByPlaceholderText(/tag/i), 'book{Enter}')
  expect(onChange).toHaveBeenCalledWith(['book'])
})

test('removes a tag when its chip is clicked', async () => {
  const onChange = vi.fn()
  render(<TagInput value={['book', 'ai']} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: /remove book/i }))
  expect(onChange).toHaveBeenCalledWith(['ai'])
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- TagInput`
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/TagInput.jsx`**

```jsx
import { useState } from 'react'

export default function TagInput({ value, onChange }) {
  const [text, setText] = useState('')

  function addTag(e) {
    e.preventDefault()
    const t = text.trim().replace(/^#/, '').toLowerCase()
    if (!t || value.includes(t)) { setText(''); return }
    onChange([...value, t])
    setText('')
  }

  function removeTag(tag) {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div>
      {value.map((t) => (
        <button key={t} type="button" aria-label={`remove ${t}`} onClick={() => removeTag(t)}>
          #{t} ✕
        </button>
      ))}
      <form onSubmit={addTag} style={{ display: 'inline' }}>
        <input placeholder="add tag" value={text} onChange={(e) => setText(e.target.value)} />
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- TagInput`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TagInput.jsx src/components/TagInput.test.jsx
git commit -m "feat: add tag input component"
```

---

## Task 6: ProgressView (TDD)

**Files:** Create `src/components/ProgressView.jsx`, `src/components/ProgressView.test.jsx`

Pure presentational: given the selected topic's entries, show counts by status.

- [ ] **Step 1: Write `src/components/ProgressView.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import ProgressView from './ProgressView.jsx'

const entries = [
  { id: '1', status: 'done', tags: ['book'] },
  { id: '2', status: 'done', tags: ['video'] },
  { id: '3', status: 'active', tags: [] },
  { id: '4', status: null, tags: [] },
]

test('shows counts per status', () => {
  render(<ProgressView topicName="AI" entries={entries} />)
  expect(screen.getByText(/Done: 2/)).toBeInTheDocument()
  expect(screen.getByText(/Active: 1/)).toBeInTheDocument()
  expect(screen.getByText(/Backlog: 0/)).toBeInTheDocument()
})

test('shows the topic name', () => {
  render(<ProgressView topicName="AI" entries={entries} />)
  expect(screen.getByText(/AI/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- ProgressView`
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/ProgressView.jsx`**

```jsx
export default function ProgressView({ topicName, entries }) {
  const count = (s) => entries.filter((e) => e.status === s).length
  return (
    <div>
      <h2>{topicName} — progress</h2>
      <p>Done: {count('done')} · Active: {count('active')} · Backlog: {count('backlog')}</p>
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- ProgressView`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressView.jsx src/components/ProgressView.test.jsx
git commit -m "feat: add per-topic progress view"
```

---

## Task 7: Revisit feed (TDD)

**Files:** Create `src/components/Revisit.jsx`, `src/components/Revisit.test.jsx`

- [ ] **Step 1: Write `src/components/Revisit.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import Revisit from './Revisit.jsx'

const entries = [
  { id: 'a', url: 'http://a.com', title: 'A', note: 'note a', tags: [] },
  { id: 'b', url: null, title: null, note: 'note b', tags: [] },
]

test('shows the first entry and advances on "seen"', async () => {
  const onSeen = vi.fn(() => Promise.resolve())
  render(<Revisit entries={entries} onSeen={onSeen} />)
  expect(screen.getByText('note a')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /seen/i }))
  expect(onSeen).toHaveBeenCalledWith('a')
  expect(screen.getByText('note b')).toBeInTheDocument()
})

test('shows empty message when nothing to revisit', () => {
  render(<Revisit entries={[]} onSeen={() => {}} />)
  expect(screen.getByText(/nothing to revisit/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- Revisit`
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/Revisit.jsx`**

```jsx
import { useState } from 'react'

export default function Revisit({ entries, onSeen }) {
  const [index, setIndex] = useState(0)
  const current = entries[index]

  if (!current) return <p>Nothing to revisit right now. 🌱</p>

  async function handleSeen() {
    await onSeen(current.id)
    setIndex((i) => i + 1)
  }

  return (
    <div>
      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
        {current.url && <a href={current.url} target="_blank" rel="noreferrer">{current.title || current.url}</a>}
        {current.note && <p style={{ whiteSpace: 'pre-wrap' }}>{current.note}</p>}
      </div>
      <button onClick={handleSeen}>Seen — next</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- Revisit`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Revisit.jsx src/components/Revisit.test.jsx
git commit -m "feat: add revisit feed component"
```

---

## Task 8: Export to markdown (TDD pure + zip wrapper)

**Files:** Create `src/lib/exportMarkdown.js`, `src/lib/exportMarkdown.test.js`, `src/lib/buildZip.js`

- [ ] **Step 1: Write `src/lib/exportMarkdown.test.js`**

```js
import { describe, test, expect } from 'vitest'
import { buildMarkdownFiles } from './exportMarkdown.js'

describe('buildMarkdownFiles', () => {
  test('produces one file per topic with entry sections', () => {
    const topics = [{ id: 't1', name: 'AI' }]
    const entries = [
      { id: 'e1', topic_id: 't1', url: 'http://a.com', title: 'A', note: 'takeaway', status: 'done', tags: ['book'] },
    ]
    const files = buildMarkdownFiles(topics, entries)
    expect(Object.keys(files)).toEqual(['AI.md'])
    const md = files['AI.md']
    expect(md).toContain('# AI')
    expect(md).toContain('[A](http://a.com)')
    expect(md).toContain('takeaway')
    expect(md).toContain('status: done')
    expect(md).toContain('tags: book')
  })

  test('skips topics with no entries', () => {
    const files = buildMarkdownFiles([{ id: 't1', name: 'Empty' }], [])
    expect(files).toEqual({})
  })

  test('sanitizes topic name into a safe filename', () => {
    const topics = [{ id: 't1', name: 'Project: Thesis/Notes' }]
    const entries = [{ id: 'e1', topic_id: 't1', url: null, title: null, note: 'x', status: null, tags: [] }]
    const files = buildMarkdownFiles(topics, entries)
    expect(Object.keys(files)).toEqual(['Project- Thesis-Notes.md'])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- exportMarkdown`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/exportMarkdown.js`**

```js
// Build a { filename: markdown } map, one file per topic that has entries.
export function buildMarkdownFiles(topics, entries) {
  const files = {}
  for (const topic of topics) {
    const own = entries.filter((e) => e.topic_id === topic.id)
    if (own.length === 0) continue
    files[`${safeName(topic.name)}.md`] = renderTopic(topic, own)
  }
  return files
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '-')
}

function renderTopic(topic, entries) {
  const lines = [`# ${topic.name}`, '']
  for (const e of entries) {
    if (e.url) lines.push(`## [${e.title || e.url}](${e.url})`)
    else lines.push(`## ${(e.note || 'note').split('\n')[0].slice(0, 60)}`)
    const meta = []
    if (e.status) meta.push(`status: ${e.status}`)
    if (e.tags && e.tags.length) meta.push(`tags: ${e.tags.join(', ')}`)
    if (meta.length) lines.push(`> ${meta.join(' · ')}`)
    lines.push('')
    if (e.note) { lines.push(e.note); lines.push('') }
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- exportMarkdown`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `src/lib/buildZip.js`** (thin jszip wrapper, no unit test)

```js
import JSZip from 'jszip'

// files: { name: contents } -> Blob of a zip
export async function buildZip(files) {
  const zip = new JSZip()
  for (const [name, contents] of Object.entries(files)) zip.file(name, contents)
  return zip.generateAsync({ type: 'blob' })
}

// Trigger a browser download of a Blob.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/exportMarkdown.js src/lib/exportMarkdown.test.js src/lib/buildZip.js
git commit -m "feat: add markdown export and zip builder"
```

---

## Task 9: Wire tags, status, progress, revisit, export into App

**Files:** Modify `src/App.jsx`

- [ ] **Step 1: Add imports to `src/App.jsx`**

```jsx
import { listForRevisit, markSurfaced } from './lib/db/entries.js'
import { setEntryTags } from './lib/db/tags.js'
import { buildMarkdownFiles } from './lib/exportMarkdown.js'
import { buildZip, downloadBlob } from './lib/buildZip.js'
import ProgressView from './components/ProgressView.jsx'
import Revisit from './components/Revisit.jsx'
```

- [ ] **Step 2: Extend `Workspace` state and handlers**

Add to the `view` comment that it now also accepts `'progress' | 'revisit'`. Add state:
```jsx
  const [revisitEntries, setRevisitEntries] = useState([])
```
Add a status-change handler and update `handleDelete`/list to pass it. Add handlers:
```jsx
  async function handleStatusChange(entryId, status) {
    const updated = await updateEntry(supabase, entryId, { status })
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e)))
  }

  async function loadRevisit() {
    setRevisitEntries(await listForRevisit(supabase, 10))
  }

  async function handleSeen(entryId) {
    await markSurfaced(supabase, entryId)
    setRevisitEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function handleExport() {
    const all = []
    for (const t of topics) {
      const rows = await listEntriesByTopic(supabase, t.id)
      all.push(...rows)
    }
    const files = buildMarkdownFiles(topics, all)
    const blob = await buildZip(files)
    downloadBlob(blob, `medialog-${new Date().toISOString().slice(0, 10)}.zip`)
  }
```

- [ ] **Step 3: Add sidebar nav links** (in the `<ul>` nav list, after Sort Inbox)

```jsx
          <li><button onClick={() => { setView('revisit'); loadRevisit() }}>Revisit</button></li>
          <li><button onClick={() => setView('progress')}>Progress</button></li>
          <li><button onClick={handleExport}>Export</button></li>
```

- [ ] **Step 4: Pass `onStatusChange` to EntryList and render new views**

Update the EntryList in browse view:
```jsx
            <EntryList entries={entries} onDelete={handleDelete} onStatusChange={handleStatusChange} />
```
Add after the `view === 'sort'` block:
```jsx
        {view === 'progress' && (
          <ProgressView
            topicName={topics.find((t) => t.id === selectedId)?.name || ''}
            entries={entries}
          />
        )}
        {view === 'revisit' && <Revisit entries={revisitEntries} onSeen={handleSeen} />}
```

- [ ] **Step 5: Thread `onStatusChange` through `EntryList`**

Modify `src/components/EntryList.jsx` to forward the prop:
```jsx
import EntryCard from './EntryCard.jsx'

export default function EntryList({ entries, onDelete, onStatusChange }) {
  if (entries.length === 0) return <p>No entries yet.</p>
  return (
    <div>
      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} onDelete={onDelete} onStatusChange={onStatusChange} />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Run full suite + build**

Run: `npm test`
Expected: all pass.
Run: `npm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/EntryList.jsx
git commit -m "feat: wire status, progress, revisit, and export into app"
```

---

## Task 10: Tag editing on entries (wire TagInput)

**Files:** Modify `src/components/EntryCard.jsx`, `src/components/EntryCard.test.jsx`, `src/App.jsx`

Allow editing tags on a card via `TagInput`, persisting through `setEntryTags`.

- [ ] **Step 1: Add a test to `src/components/EntryCard.test.jsx`**

Add `onTagsChange` to the existing renders (pass `() => {}` where unused) and add:
```jsx
test('edits tags through TagInput', async () => {
  const onTagsChange = vi.fn()
  render(<EntryCard entry={{ ...base, tags: [] }} onDelete={() => {}} onStatusChange={() => {}} onTagsChange={onTagsChange} />)
  await userEvent.type(screen.getByPlaceholderText(/add tag/i), 'book{Enter}')
  expect(onTagsChange).toHaveBeenCalledWith('x', ['book'])
})
```
(Update the other `render(<EntryCard ... />)` calls in this file to include `onTagsChange={() => {}}` so they don't crash.)

- [ ] **Step 2: Run test, verify the new test fails**

Run: `npm test -- EntryCard`
Expected: FAIL on the new test.

- [ ] **Step 3: Update `src/components/EntryCard.jsx`**

Import TagInput and render it, replacing the static tag chips block:
```jsx
import TagInput from './TagInput.jsx'
```
Replace the `{entry.tags && entry.tags.length > 0 && (...)}` block with:
```jsx
      <TagInput
        value={entry.tags || []}
        onChange={(next) => onTagsChange(entry.id, next)}
      />
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- EntryCard`
Expected: PASS (6 tests).

- [ ] **Step 5: Thread `onTagsChange` through `EntryList` and `App`**

In `src/components/EntryList.jsx` add `onTagsChange` to props and pass to `EntryCard`:
```jsx
export default function EntryList({ entries, onDelete, onStatusChange, onTagsChange }) {
  if (entries.length === 0) return <p>No entries yet.</p>
  return (
    <div>
      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} onDelete={onDelete} onStatusChange={onStatusChange} onTagsChange={onTagsChange} />
      ))}
    </div>
  )
}
```
In `src/App.jsx` add the handler and pass it:
```jsx
  async function handleTagsChange(entryId, tags) {
    await setEntryTags(supabase, entryId, tags)
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, tags } : e)))
  }
```
and update the browse EntryList:
```jsx
            <EntryList entries={entries} onDelete={handleDelete} onStatusChange={handleStatusChange} onTagsChange={handleTagsChange} />
```

- [ ] **Step 6: Run full suite + build**

Run: `npm test` then `npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/EntryCard.jsx src/components/EntryCard.test.jsx src/components/EntryList.jsx src/App.jsx
git commit -m "feat: edit entry tags inline"
```

---

## Done criteria for Plan 3

- `npm test` passes all suites (tags, entries additions, EntryCard, TagInput, ProgressView, Revisit, exportMarkdown, plus existing).
- `npm run build` succeeds.
- USER-verified live: set an entry's status and see progress counts; add tags and see chips/filtering; notes render markdown incl. checkboxes; Revisit surfaces least-recently-seen entries and "Seen" advances; Export downloads a zip of per-topic markdown that opens cleanly on Windows.
- Feature set now matches the spec. Next: the dedicated visual/design pass over the complete app.
```
