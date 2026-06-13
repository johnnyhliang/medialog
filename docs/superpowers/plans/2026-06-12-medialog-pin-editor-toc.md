# MediaLog Plan 4 — Pin, Real Editor & Topic TOC

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make topics maintainable study/reference workspaces without crossing into iPad note-taking territory: pin entries, a real CodeMirror markdown editor with autosave, and a per-topic table of contents built from `#` headers.

**Architecture:** Adds a `pinned` column to entries (pinned sort to top). Note editing swaps the plain textarea for a CodeMirror 6 editor (`@uiw/react-codemirror` + `@codemirror/lang-markdown`) with list/checkbox continuation, tab indent, Ctrl+F search, and debounced autosave. A `TopicTOC` component indexes entries whose note begins with an H1 (`# Heading`) and jumps to them via entry anchors. Markdown links open in new tabs.

**Tech Stack:** Existing + `@uiw/react-codemirror`, `@codemirror/lang-markdown`, `@codemirror/language-data`, `@codemirror/commands`, `@codemirror/view`, `@codemirror/state`.

**Scope note:** Plan 4. Boundary respected — MediaLog stays a short-form media-log; this is a *good editor for short notes + navigation*, NOT a long-form study-notes app (that stays on iPad). No interactive task-list checkboxes in rendered cards (deliberately excluded). Configurable dashboard is a separate future plan.

**Source spec:** `docs/superpowers/specs/2026-06-07-medialog-design.md`

**Prerequisite:** Plans 1–3 merged or on the working branch. Supabase live.

---

## File Structure

```
supabase/migrations/0002_pinned.sql        — add entries.pinned (user-applied)
src/lib/db/entries.js                       — MODIFY: pinned-first ordering in listEntriesByTopic
src/lib/db/entries.test.js                  — MODIFY: assert pinned ordering
src/lib/firstHeading.js                     — pure: extract leading '# Heading' from a note
src/lib/firstHeading.test.js
src/components/NoteEditor.jsx                — CodeMirror markdown editor wrapper
src/components/TopicTOC.jsx                  — table of contents from H1 headers
src/components/TopicTOC.test.jsx
src/components/EntryCard.jsx                 — MODIFY: pin button, edit mode (NoteEditor+autosave), new-tab links, anchor id
src/components/EntryCard.test.jsx            — MODIFY: pin + edit assertions (NoteEditor mocked)
src/components/EntryList.jsx                 — MODIFY: thread onTogglePin, onNoteSave
src/App.jsx                                  — MODIFY: handlers + TopicTOC in browse
package.json                                 — MODIFY: editor deps
```

---

## Task 1: Dependencies + pinned migration

**Files:** Modify `package.json`; Create `supabase/migrations/0002_pinned.sql`

- [ ] **Step 1: Install editor deps**

Run: `npm install @uiw/react-codemirror @codemirror/lang-markdown @codemirror/language-data @codemirror/commands @codemirror/view @codemirror/state`
Expected: added to dependencies.

- [ ] **Step 2: Create `supabase/migrations/0002_pinned.sql`**

```sql
alter table entries add column pinned boolean not null default false;
```

- [ ] **Step 3: Verify suite still green**

Run: `npm test`
Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json supabase/migrations/0002_pinned.sql
git commit -m "chore: add codemirror deps and pinned column migration"
```

- [ ] **Step 5: Apply migration (USER step)**

Supabase dashboard → SQL Editor → run `0002_pinned.sql`. Expected: success; `entries` now has a `pinned` column.

---

## Task 2: Pinned-first ordering (TDD)

**Files:** Modify `src/lib/db/entries.js`, `src/lib/db/entries.test.js`

- [ ] **Step 1: Update the `listEntriesByTopic` test in `src/lib/db/entries.test.js`**

Replace the existing `listEntriesByTopic` test with:
```js
  test('listEntriesByTopic orders pinned first then newest, flattening tags', async () => {
    const raw = [{ id: 'a', note: 'hi', pinned: true, entry_tags: [{ tags: { name: 'book' } }] }]
    const client = mockClient({ data: raw, error: null })
    const result = await listEntriesByTopic(client, 'topic-1')
    expect(client.from).toHaveBeenCalledWith('entries')
    expect(client._chain.select).toHaveBeenCalledWith('*, entry_tags(tags(name))')
    expect(client._chain.eq).toHaveBeenCalledWith('topic_id', 'topic-1')
    expect(client._chain.order).toHaveBeenCalledWith('pinned', { ascending: false })
    expect(client._chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual([{ id: 'a', note: 'hi', pinned: true, tags: ['book'] }])
  })
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- entries`
Expected: FAIL (only one `order` call currently).

- [ ] **Step 3: Update `listEntriesByTopic` in `src/lib/db/entries.js`**

```js
export async function listEntriesByTopic(supabase, topicId) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .eq('topic_id', topicId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- entries`
Expected: PASS.

Note: pin toggling and note saving reuse the existing `updateEntry(supabase, id, patch)` — no new data-layer function needed (`updateEntry(s, id, { pinned })` / `updateEntry(s, id, { note })`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/entries.js src/lib/db/entries.test.js
git commit -m "feat: order pinned entries first"
```

---

## Task 3: firstHeading helper (TDD)

**Files:** Create `src/lib/firstHeading.js`, `src/lib/firstHeading.test.js`

- [ ] **Step 1: Write `src/lib/firstHeading.test.js`**

```js
import { describe, test, expect } from 'vitest'
import { firstHeading } from './firstHeading.js'

describe('firstHeading', () => {
  test('returns the text of a leading H1', () => {
    expect(firstHeading('# Linear Algebra\nsome notes')).toBe('Linear Algebra')
  })

  test('ignores deeper headings and non-heading first lines', () => {
    expect(firstHeading('## Sub\ntext')).toBeNull()
    expect(firstHeading('just a note')).toBeNull()
  })

  test('skips leading blank lines', () => {
    expect(firstHeading('\n\n# Title')).toBe('Title')
  })

  test('returns null for empty input', () => {
    expect(firstHeading('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- firstHeading`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/firstHeading.js`**

```js
// Returns the text of a note's leading level-1 markdown heading (`# Heading`),
// or null. Used to build the per-topic table of contents.
export function firstHeading(note) {
  if (!note) return null
  for (const line of note.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const m = trimmed.match(/^#\s+(.*)$/)
    return m ? m[1].trim() : null
  }
  return null
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- firstHeading`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/firstHeading.js src/lib/firstHeading.test.js
git commit -m "feat: add firstHeading helper for table of contents"
```

---

## Task 4: TopicTOC component (TDD)

**Files:** Create `src/components/TopicTOC.jsx`, `src/components/TopicTOC.test.jsx`

- [ ] **Step 1: Write `src/components/TopicTOC.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import TopicTOC from './TopicTOC.jsx'

const entries = [
  { id: 'e1', note: '# Linear Algebra\nrow reduction' },
  { id: 'e2', note: 'plain note, no heading' },
  { id: 'e3', note: '# Eigenvalues' },
]

test('lists only entries with an H1 heading, linking to their anchors', () => {
  render(<TopicTOC entries={entries} />)
  const la = screen.getByRole('link', { name: 'Linear Algebra' })
  expect(la).toHaveAttribute('href', '#entry-e1')
  expect(screen.getByRole('link', { name: 'Eigenvalues' })).toHaveAttribute('href', '#entry-e3')
  expect(screen.queryByText('plain note, no heading')).not.toBeInTheDocument()
})

test('renders nothing when no entry has a heading', () => {
  const { container } = render(<TopicTOC entries={[{ id: 'x', note: 'no heading' }]} />)
  expect(container).toBeEmptyDOMElement()
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- TopicTOC`
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/TopicTOC.jsx`**

```jsx
import { firstHeading } from '../lib/firstHeading.js'

export default function TopicTOC({ entries }) {
  const items = entries
    .map((e) => ({ id: e.id, heading: firstHeading(e.note) }))
    .filter((x) => x.heading)

  if (items.length === 0) return null

  return (
    <nav className="toc">
      <p className="section-label">Contents</p>
      <ul>
        {items.map((x) => (
          <li key={x.id}><a href={`#entry-${x.id}`}>{x.heading}</a></li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- TopicTOC`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TopicTOC.jsx src/components/TopicTOC.test.jsx
git commit -m "feat: add per-topic table of contents"
```

---

## Task 5: NoteEditor (CodeMirror wrapper)

**Files:** Create `src/components/NoteEditor.jsx`

No Vitest coverage (CodeMirror needs real layout; verified manually). EntryCard tests mock this module.

- [ ] **Step 1: Implement `src/components/NoteEditor.jsx`**

```jsx
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage, insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { Prec } from '@codemirror/state'

// Markdown editor: list/checkbox continuation on Enter, smart backspace,
// Tab indent. basicSetup provides Ctrl+F search + undo history.
const mdKeymap = Prec.high(
  keymap.of([
    { key: 'Enter', run: insertNewlineContinueMarkup },
    { key: 'Backspace', run: deleteMarkupBackward },
    indentWithTab,
  ]),
)

export default function NoteEditor({ value, onChange }) {
  return (
    <CodeMirror
      value={value}
      theme="dark"
      extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), mdKeymap]}
      onChange={onChange}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
    />
  )
}
```

- [ ] **Step 2: Build check (verifies imports resolve)**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/NoteEditor.jsx
git commit -m "feat: add codemirror markdown note editor"
```

---

## Task 6: EntryCard — pin, edit mode, autosave, new-tab links (TDD)

**Files:** Modify `src/components/EntryCard.jsx`, `src/components/EntryCard.test.jsx`

Edit mode swaps the rendered note for `NoteEditor`; changes autosave (debounced) and a Done button closes the editor. A ★ pin button toggles pinned. Markdown links open new tabs. The card has `id="entry-<id>"` so the TOC can jump to it.

- [ ] **Step 1: Replace `src/components/EntryCard.test.jsx`** (NoteEditor mocked as a textarea so logic is testable)

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './EntryCard.jsx'

// Mock the CodeMirror wrapper with a plain textarea.
vi.mock('./NoteEditor.jsx', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="note editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my **takeaway**', status: null, tags: [], pinned: false }
const noop = () => {}
const handlers = { onDelete: noop, onStatusChange: noop, onTagsChange: noop, onTogglePin: noop, onNoteSave: noop }

test('renders markdown note and links open in a new tab', () => {
  render(<EntryCard entry={base} {...handlers} />)
  const link = screen.getByRole('link', { name: 'A Site' })
  expect(link).toHaveAttribute('target', '_blank')
})

test('has an anchor id for the table of contents', () => {
  const { container } = render(<EntryCard entry={base} {...handlers} />)
  expect(container.querySelector('#entry-x')).not.toBeNull()
})

test('toggles pin', async () => {
  const onTogglePin = vi.fn()
  render(<EntryCard entry={base} {...handlers} onTogglePin={onTogglePin} />)
  await userEvent.click(screen.getByRole('button', { name: /pin/i }))
  expect(onTogglePin).toHaveBeenCalledWith('x', true)
})

test('edits the note and saves on Done', async () => {
  const onNoteSave = vi.fn()
  render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  const editor = screen.getByLabelText('note editor')
  await userEvent.clear(editor)
  await userEvent.type(editor, 'updated note')
  await userEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(onNoteSave).toHaveBeenCalledWith('x', 'updated note')
})

test('changes status and fires delete', async () => {
  const onStatusChange = vi.fn()
  const onDelete = vi.fn()
  render(<EntryCard entry={base} {...handlers} onStatusChange={onStatusChange} onDelete={onDelete} />)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})

test('edits tags through TagInput', async () => {
  const onTagsChange = vi.fn()
  render(<EntryCard entry={{ ...base, tags: [] }} {...handlers} onTagsChange={onTagsChange} />)
  await userEvent.type(screen.getByPlaceholderText(/add tag/i), 'book{Enter}')
  expect(onTagsChange).toHaveBeenCalledWith('x', ['book'])
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- EntryCard`
Expected: FAIL.

- [ ] **Step 3: Replace `src/components/EntryCard.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TagInput from './TagInput.jsx'
import NoteEditor from './NoteEditor.jsx'

const STATUSES = ['', 'backlog', 'active', 'done']
const mdComponents = {
  a: ({ node, ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
}

export default function EntryCard({ entry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.note || '')
  const timer = useRef(null)
  const statusClass = entry.status ? `status-${entry.status}` : 'status-backlog'

  // Debounced autosave while editing.
  useEffect(() => {
    if (!editing) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onNoteSave(entry.id, draft), 800)
    return () => clearTimeout(timer.current)
  }, [draft, editing])

  function finishEditing() {
    if (timer.current) clearTimeout(timer.current)
    onNoteSave(entry.id, draft)
    setEditing(false)
  }

  return (
    <div className={`card${entry.pinned ? ' pinned' : ''}`} id={`entry-${entry.id}`}>
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer">
          {entry.title || entry.url}
        </a>
      )}

      {editing ? (
        <NoteEditor value={draft} onChange={setDraft} />
      ) : (
        entry.note && (
          <div className="note">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{entry.note}</ReactMarkdown>
          </div>
        )
      )}

      <div className="card-meta">
        <TagInput value={entry.tags || []} onChange={(next) => onTagsChange(entry.id, next)} />
        <div className="card-actions">
          <button className="icon-btn" aria-label={entry.pinned ? 'unpin' : 'pin'} onClick={() => onTogglePin(entry.id, !entry.pinned)}>
            {entry.pinned ? '★' : '☆'}
          </button>
          {editing ? (
            <button onClick={finishEditing}>Done</button>
          ) : (
            <button className="icon-btn" aria-label="edit" onClick={() => { setDraft(entry.note || ''); setEditing(true) }}>✎</button>
          )}
          <select
            className={`status-select ${statusClass}`}
            value={entry.status || ''}
            onChange={(e) => onStatusChange(entry.id, e.target.value || null)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === '' ? 'no status' : s}</option>
            ))}
          </select>
          <button className="icon-btn" onClick={() => onDelete(entry.id)} aria-label="delete">🗑</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- EntryCard`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/EntryCard.jsx src/components/EntryCard.test.jsx
git commit -m "feat: pin button, codemirror edit mode with autosave, new-tab links"
```

---

## Task 7: Thread props + wire App (TDD where applicable)

**Files:** Modify `src/components/EntryList.jsx`, `src/App.jsx`

- [ ] **Step 1: Update `src/components/EntryList.jsx`**

```jsx
import EntryCard from './EntryCard.jsx'

export default function EntryList({ entries, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave }) {
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
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add handlers + TOC to `src/App.jsx`**

Add import:
```jsx
import TopicTOC from './components/TopicTOC.jsx'
```
Add handlers in `Workspace` (after `handleTagsChange`):
```jsx
  async function handleTogglePin(entryId, pinned) {
    const updated = await updateEntry(supabase, entryId, { pinned })
    setEntries((prev) => {
      const next = prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e))
      return [...next].sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1))
    })
  }

  async function handleNoteSave(entryId, note) {
    const updated = await updateEntry(supabase, entryId, { note })
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e)))
  }
```
In the browse view block, render the TOC above the entry list and pass the new props. Replace the browse `EntryList` block:
```jsx
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            <TopicTOC entries={entries} />
            <EntryList
              entries={statusFilter ? entries.filter((e) => e.status === statusFilter) : entries}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onTagsChange={handleTagsChange}
              onTogglePin={handleTogglePin}
              onNoteSave={handleNoteSave}
            />
```

- [ ] **Step 3: Add minimal CSS to `src/styles.css`**

```css
/* Table of contents */
.toc { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; }
.toc ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.toc a { color: var(--text); }
.toc a:hover { color: var(--accent); }
.card.pinned { border-color: var(--accent); }

/* CodeMirror sits flush in the card */
.card .cm-editor { border: 1px solid var(--border); border-radius: 7px; }
```

- [ ] **Step 4: Run full suite + build**

Run: `npm test`
Expected: all pass (App smoke test unaffected — it renders the logged-out view).
Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/EntryList.jsx src/App.jsx src/styles.css
git commit -m "feat: wire pin, note autosave, and table of contents into app"
```

---

## Done criteria for Plan 4

- `npm test` passes all suites (firstHeading, TopicTOC, EntryCard pin/edit, entries ordering, plus existing).
- `npm run build` succeeds.
- USER-verified live (after applying `0002_pinned.sql`): pin an entry → it jumps to the top; edit a note → CodeMirror opens, Enter continues bullets/checkboxes, Tab indents, Ctrl+F searches, edits autosave; a note starting with `# Heading` appears in the topic's Contents and clicking it jumps to the card; markdown links open in new tabs.
- Boundary held: still short-form entries in buckets; no long-form/study-notes drift.
```
