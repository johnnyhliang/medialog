# MediaLog Plan 6 — Editor Preview & Version Control

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** Add a live rendered-preview pane to the note editor, and version history (snapshot on commit, view + restore) — the undo safety net before AI features touch content.

**Architecture:** New `entry_versions` table (RLS, one row per committed edit). EntryCard edit mode shows CodeMirror + a live `react-markdown` preview side-by-side. Autosave updates the note (no version); pressing Done commits a version snapshot. A VersionHistory panel lists snapshots and restores one (restore = set note + new snapshot). Pure data-layer functions, TDD.

**Tech Stack:** Existing (React/Vite/Vitest/Supabase, react-markdown, CodeMirror).

**Prerequisite:** master @ merged MVP.

---

## File Structure
```
supabase/migrations/0003_entry_versions.sql   — versions table + RLS (user-applied)
src/lib/db/versions.js                          — listVersions, createVersion
src/lib/db/versions.test.js
src/components/VersionHistory.jsx               — list + restore panel
src/components/VersionHistory.test.jsx
src/components/EntryCard.jsx                     — MODIFY: live preview split, commit-on-Done, History toggle
src/components/EntryCard.test.jsx                — MODIFY: preview + version handler assertions
src/components/EntryList.jsx                     — MODIFY: thread version handlers
src/App.jsx                                      — MODIFY: version handlers
src/styles.css                                   — MODIFY: editor split + preview styles
```

---

## Task 1: Versions migration
**Files:** Create `supabase/migrations/0003_entry_versions.sql`

- [ ] **Step 1: Write the migration**
```sql
create table entry_versions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id   uuid not null references entries(id) on delete cascade,
  note       text not null default '',
  created_at timestamptz not null default now()
);
alter table entry_versions enable row level security;
create policy "own versions" on entry_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index entry_versions_entry_idx on entry_versions (entry_id, created_at desc);
```
- [ ] **Step 2: Commit**
```bash
git add supabase/migrations/0003_entry_versions.sql
git commit -m "feat: add entry_versions table migration"
```
- [ ] **Step 3 (USER):** Run `0003_entry_versions.sql` in Supabase SQL editor.

---

## Task 2: Versions data layer (TDD)
**Files:** Create `src/lib/db/versions.js`, `src/lib/db/versions.test.js`

- [ ] **Step 1: Write `src/lib/db/versions.test.js`**
```js
import { describe, test, expect, vi } from 'vitest'
import { listVersions, createVersion } from './versions.js'

function mockClient(result) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}

describe('versions db', () => {
  test('listVersions returns snapshots newest first', async () => {
    const rows = [{ id: 'v2', note: 'b' }, { id: 'v1', note: 'a' }]
    const client = mockClient({ data: rows, error: null })
    const result = await listVersions(client, 'e1')
    expect(client.from).toHaveBeenCalledWith('entry_versions')
    expect(client._chain.eq).toHaveBeenCalledWith('entry_id', 'e1')
    expect(client._chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(rows)
  })

  test('createVersion inserts a snapshot', async () => {
    const row = { id: 'v3', entry_id: 'e1', note: 'c' }
    const client = mockClient({ data: row, error: null })
    const result = await createVersion(client, 'e1', 'c')
    expect(client._chain.insert).toHaveBeenCalledWith({ entry_id: 'e1', note: 'c' })
    expect(result).toEqual(row)
  })
})
```
- [ ] **Step 2: Run `npm test -- versions` → FAIL.**
- [ ] **Step 3: Implement `src/lib/db/versions.js`**
```js
export async function listVersions(supabase, entryId) {
  const { data, error } = await supabase
    .from('entry_versions')
    .select('*')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function createVersion(supabase, entryId, note) {
  const { data, error } = await supabase
    .from('entry_versions')
    .insert({ entry_id: entryId, note })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```
- [ ] **Step 4: Run `npm test -- versions` → PASS (2).**
- [ ] **Step 5: Commit**
```bash
git add src/lib/db/versions.js src/lib/db/versions.test.js
git commit -m "feat: add entry versions data layer"
```

---

## Task 3: VersionHistory component (TDD)
**Files:** Create `src/components/VersionHistory.jsx`, `src/components/VersionHistory.test.jsx`

- [ ] **Step 1: Write `src/components/VersionHistory.test.jsx`**
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import VersionHistory from './VersionHistory.jsx'

const versions = [
  { id: 'v2', note: 'second draft', created_at: '2026-06-14T10:00:00Z' },
  { id: 'v1', note: 'first draft', created_at: '2026-06-13T10:00:00Z' },
]

test('lists versions with a preview', () => {
  render(<VersionHistory versions={versions} onRestore={() => {}} />)
  expect(screen.getByText(/second draft/)).toBeInTheDocument()
  expect(screen.getByText(/first draft/)).toBeInTheDocument()
})

test('restores a chosen version', async () => {
  const onRestore = vi.fn()
  render(<VersionHistory versions={versions} onRestore={onRestore} />)
  await userEvent.click(screen.getAllByRole('button', { name: /restore/i })[1])
  expect(onRestore).toHaveBeenCalledWith('first draft')
})

test('shows empty state', () => {
  render(<VersionHistory versions={[]} onRestore={() => {}} />)
  expect(screen.getByText(/no past versions/i)).toBeInTheDocument()
})
```
- [ ] **Step 2: Run `npm test -- VersionHistory` → FAIL.**
- [ ] **Step 3: Implement `src/components/VersionHistory.jsx`**
```jsx
export default function VersionHistory({ versions, onRestore }) {
  if (versions.length === 0) return <p className="muted">No past versions yet.</p>
  return (
    <ul className="versions">
      {versions.map((v) => (
        <li key={v.id}>
          <span className="version-date">{new Date(v.created_at).toLocaleString()}</span>
          <span className="version-preview">{v.note.slice(0, 80) || '(empty)'}</span>
          <button onClick={() => onRestore(v.note)}>Restore</button>
        </li>
      ))}
    </ul>
  )
}
```
- [ ] **Step 4: Run `npm test -- VersionHistory` → PASS (3).**
- [ ] **Step 5: Commit**
```bash
git add src/components/VersionHistory.jsx src/components/VersionHistory.test.jsx
git commit -m "feat: add version history panel"
```

---

## Task 4: EntryCard — live preview, commit-on-Done, history toggle (TDD)
**Files:** Modify `src/components/EntryCard.jsx`, `src/components/EntryCard.test.jsx`

Edit mode becomes a split: NoteEditor (left) + live markdown preview (right). Autosave still calls `onNoteSave`; **Done** calls `onNoteSave` then `onNoteVersion` (commit a snapshot). A "History" button calls `onShowHistory` and renders `historyPanel` (passed in, already wired to data) — to keep EntryCard pure, history data is loaded by the parent and passed as a render prop/node.

- [ ] **Step 1: Replace `src/components/EntryCard.test.jsx`** (NoteEditor mocked as before)
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './EntryCard.jsx'

vi.mock('./NoteEditor.jsx', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="note editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const base = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my **takeaway**', status: null, tags: [], pinned: false }
const noop = () => {}
const handlers = {
  onDelete: noop, onStatusChange: noop, onTagsChange: noop, onTogglePin: noop,
  onNoteSave: noop, onNoteVersion: noop, onShowHistory: noop,
}

test('renders markdown note and links open in a new tab', () => {
  render(<EntryCard entry={base} {...handlers} />)
  expect(screen.getByRole('link', { name: 'A Site' })).toHaveAttribute('target', '_blank')
})

test('shows a live preview while editing', async () => {
  render(<EntryCard entry={base} {...handlers} />)
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.clear(editor)
  await userEvent.type(editor, '# Heading now')
  // preview region renders the markdown as a heading
  expect(screen.getByRole('heading', { name: 'Heading now' })).toBeInTheDocument()
})

test('commits a version on Done', async () => {
  const onNoteSave = vi.fn()
  const onNoteVersion = vi.fn()
  render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} onNoteVersion={onNoteVersion} />)
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.clear(editor)
  await userEvent.type(editor, 'committed text')
  await userEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(onNoteSave).toHaveBeenCalledWith('x', 'committed text')
  expect(onNoteVersion).toHaveBeenCalledWith('x', 'committed text')
})

test('requests history', async () => {
  const onShowHistory = vi.fn()
  render(<EntryCard entry={base} {...handlers} onShowHistory={onShowHistory} />)
  await userEvent.click(screen.getByRole('button', { name: /history/i }))
  expect(onShowHistory).toHaveBeenCalledWith('x')
})

test('toggles pin, status, delete, tags', async () => {
  const onTogglePin = vi.fn(); const onStatusChange = vi.fn(); const onDelete = vi.fn(); const onTagsChange = vi.fn()
  render(<EntryCard entry={base} {...handlers} onTogglePin={onTogglePin} onStatusChange={onStatusChange} onDelete={onDelete} onTagsChange={onTagsChange} />)
  await userEvent.click(screen.getByRole('button', { name: /pin/i }))
  expect(onTogglePin).toHaveBeenCalledWith('x', true)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
  await userEvent.type(screen.getByPlaceholderText(/add tag/i), 'book{Enter}')
  expect(onTagsChange).toHaveBeenCalledWith('x', ['book'])
})
```
- [ ] **Step 2: Run `npm test -- EntryCard` → FAIL.**
- [ ] **Step 3: Replace `src/components/EntryCard.jsx`**
```jsx
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TagInput from './TagInput.jsx'

const NoteEditor = lazy(() => import('./NoteEditor.jsx'))
const STATUSES = ['', 'backlog', 'active', 'done']
const mdComponents = { a: ({ node, ...props }) => <a target="_blank" rel="noreferrer" {...props} /> }

export default function EntryCard({
  entry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onNoteVersion, onShowHistory,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.note || '')
  const timer = useRef(null)
  const statusClass = entry.status ? `status-${entry.status}` : 'status-backlog'

  useEffect(() => {
    if (!editing) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onNoteSave(entry.id, draft), 800)
    return () => clearTimeout(timer.current)
  }, [draft, editing])

  function finishEditing() {
    if (timer.current) clearTimeout(timer.current)
    onNoteSave(entry.id, draft)
    onNoteVersion(entry.id, draft)
    setEditing(false)
  }

  return (
    <div className={`card${entry.pinned ? ' pinned' : ''}`} id={`entry-${entry.id}`}>
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer">{entry.title || entry.url}</a>
      )}

      {editing ? (
        <div className="editor-split">
          <Suspense fallback={<p className="muted">Loading editor…</p>}>
            <NoteEditor value={draft} onChange={setDraft} />
          </Suspense>
          <div className="note preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{draft}</ReactMarkdown>
          </div>
        </div>
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
          <button className="icon-btn" aria-label="history" onClick={() => onShowHistory(entry.id)}>�途</button>
          {editing ? (
            <button onClick={finishEditing}>Done</button>
          ) : (
            <button className="icon-btn" aria-label="edit" onClick={() => { setDraft(entry.note || ''); setEditing(true) }}>✎</button>
          )}
          <select className={`status-select ${statusClass}`} value={entry.status || ''} onChange={(e) => onStatusChange(entry.id, e.target.value || null)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === '' ? 'no status' : s}</option>)}
          </select>
          <button className="icon-btn" onClick={() => onDelete(entry.id)} aria-label="delete">🗑</button>
        </div>
      </div>
    </div>
  )
}
```
Note: use a plain history glyph (e.g. `🕘`) for the History button; ensure `aria-label="history"`.
- [ ] **Step 4: Run `npm test -- EntryCard` → PASS.**
- [ ] **Step 5: Commit**
```bash
git add src/components/EntryCard.jsx src/components/EntryCard.test.jsx
git commit -m "feat: live preview split, version commit on done, history button"
```

---

## Task 5: Thread handlers + App wiring + history modal + CSS
**Files:** Modify `src/components/EntryList.jsx`, `src/App.jsx`, `src/styles.css`

- [ ] **Step 1: `EntryList.jsx`** — add `onNoteVersion`, `onShowHistory` to props and pass through to `EntryCard` (alongside existing handlers).
- [ ] **Step 2: `App.jsx`** — import `listVersions, createVersion` from `./lib/db/versions.js`, add `VersionHistory`. State: `const [historyFor, setHistoryFor] = useState(null); const [versions, setVersions] = useState([])`. Handlers:
```jsx
  async function handleNoteVersion(entryId, note) {
    await createVersion(supabase, entryId, note)
  }
  async function handleShowHistory(entryId) {
    setVersions(await listVersions(supabase, entryId))
    setHistoryFor(entryId)
  }
  async function handleRestore(note) {
    await updateEntry(supabase, historyFor, { note })
    await createVersion(supabase, historyFor, note)
    setEntries((prev) => prev.map((e) => (e.id === historyFor ? { ...e, note } : e)))
    setHistoryFor(null)
  }
```
Pass `onNoteVersion={handleNoteVersion}` and `onShowHistory={handleShowHistory}` to the browse `EntryList`. Render a simple modal/panel when `historyFor`:
```jsx
        {historyFor && (
          <div className="history-modal" onClick={() => setHistoryFor(null)}>
            <div className="history-panel" onClick={(e) => e.stopPropagation()}>
              <p className="section-label">Version history</p>
              <VersionHistory versions={versions} onRestore={handleRestore} />
              <button onClick={() => setHistoryFor(null)}>Close</button>
            </div>
          </div>
        )}
```
- [ ] **Step 3: `styles.css`** — add:
```css
.editor-split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.editor-split .preview { background: var(--surface-2); border-radius: 7px; padding: 8px 12px; overflow: auto; }
@media (max-width: 680px) { .editor-split { grid-template-columns: 1fr; } }
.versions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.versions li { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); padding: 6px 0; }
.version-date { color: var(--muted); font-size: 12px; white-space: nowrap; }
.version-preview { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
.history-panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; max-width: 560px; width: 100%; max-height: 70vh; overflow: auto; }
```
- [ ] **Step 4: `npm test` (all pass) + `npm run build` (success).**
- [ ] **Step 5: Commit**
```bash
git add src/components/EntryList.jsx src/App.jsx src/styles.css
git commit -m "feat: wire version history (view/restore) and editor preview styles"
```

---

## Done criteria
- All tests pass; build green.
- USER (after `0003` migration): editing shows live preview; Done saves a version; History lists past versions and Restore reverts the note.
