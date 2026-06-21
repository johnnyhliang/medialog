# Topic Lifecycle (Archive + Delete + Restore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give topics two new lifecycle states — archived (hidden in a collapsible sidebar section, still browsable) and deleted (soft-deleted to Trash with full restore, entries come back to the same topic).

**Architecture:** A single migration adds `archived_at` and `deleted_at` to `topics`. `listTopics` returns non-deleted topics (active + archived combined); the sidebar filters them. Soft-deleting a topic also soft-deletes all its non-deleted entries; restoring brings them back to the original topic (not inbox). Each topic row in the sidebar gets a hover-reveal `⋯` menu with Archive and Delete actions. TrashView gains a "Deleted Topics" section above the existing entry trash.

**Tech Stack:** React 18, Vite 5, Supabase JS v2, Vitest + @testing-library/react, custom CSS in `src/styles.css`

## Global Constraints

- All CSS in `src/styles.css` only — no inline `<style>` blocks
- No new npm packages
- All existing tests must pass after every task (`npm test -- --run`)
- Follow existing CSS naming: `topic-` prefix for new classes
- `listTopics` must **not** return deleted topics (`deleted_at IS NOT NULL`) — it does return archived ones
- Restoring a deleted topic restores all its entries back to the same topic (not inbox) — individual entry restore goes to inbox; topic restore is a unit

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/0017_topic_lifecycle.sql` | CREATE — adds `archived_at`, `deleted_at` to `topics` |
| `src/lib/db/topics.js` | MODIFY — update `listTopics` filter; add `archiveTopic`, `unarchiveTopic`, `softDeleteTopic`, `restoreDeletedTopic`, `listDeletedTopics` |
| `src/hooks/useTopics.js` | MODIFY — add `applyArchiveTopic`, `applyUnarchiveTopic`, `applyDeleteTopic`, `applyRestoreDeletedTopic`; split `topics` into `activeTopics` + `archivedTopics` derived values |
| `src/components/TopicList.jsx` | MODIFY — three-dot menu per topic; archived section |
| `src/components/TrashView.jsx` | MODIFY — deleted topics section above entries |
| `src/App.jsx` | MODIFY — wire `handleArchiveTopic`, `handleUnarchiveTopic`, `handleDeleteTopic`, `handleRestoreTopic`; pass `deletedTopics` to TrashView; pass new handlers to TopicList |
| `src/styles.css` | MODIFY — append topic menu + archived section styles |

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/0017_topic_lifecycle.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0017_topic_lifecycle.sql

alter table topics add column if not exists archived_at timestamptz default null;
alter table topics add column if not exists deleted_at  timestamptz default null;
```

- [ ] **Step 2: Apply it**

```bash
npx supabase db push
```

Expected: no errors. If `db push` is unavailable run `npx supabase migration up`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0017_topic_lifecycle.sql
git commit -m "feat: add archived_at and deleted_at columns to topics"
```

---

## Task 2: DB functions

**Files:**
- Modify: `src/lib/db/topics.js`
- Modify: `src/lib/db/topics.test.js` (create if missing)

**Interfaces:**
- Produces:
  - `listTopics(supabase)` → `Topic[]` — active + archived, excludes deleted
  - `listDeletedTopics(supabase)` → `Topic[]` — only deleted, ordered by `deleted_at` desc
  - `archiveTopic(supabase, id)` → `Topic`
  - `unarchiveTopic(supabase, id)` → `Topic`
  - `softDeleteTopic(supabase, id)` → `void` — also soft-deletes all non-deleted entries in topic
  - `restoreDeletedTopic(supabase, id)` → `void` — restores topic + all entries back to that topic

- [ ] **Step 1: Read the current file**

Read `src/lib/db/topics.js` before editing.

- [ ] **Step 2: Write failing tests**

Create `src/lib/db/topics.test.js`:

```js
// src/lib/db/topics.test.js
import { describe, test, expect, vi } from 'vitest'
import { listTopics, listDeletedTopics, archiveTopic, unarchiveTopic, softDeleteTopic, restoreDeletedTopic } from './topics.js'

function makeClient(rows = [], single = null) {
  const chain = {
    select: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    update: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: single, error: null })),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}

test('listTopics excludes deleted topics', async () => {
  const sb = makeClient([{ id: 't1', name: 'AI', archived_at: null, deleted_at: null, entries: [{ count: 2 }] }])
  const result = await listTopics(sb)
  expect(sb._chain.is).toHaveBeenCalledWith('deleted_at', null)
  expect(result[0].entry_count).toBe(2)
})

test('listDeletedTopics orders by deleted_at desc', async () => {
  const sb = makeClient([{ id: 't2', name: 'Old', archived_at: null, deleted_at: '2026-06-01', entries: [{ count: 0 }] }])
  const result = await listDeletedTopics(sb)
  expect(sb._chain.not).toHaveBeenCalledWith('deleted_at', 'is', null)
  expect(result[0].name).toBe('Old')
})

test('archiveTopic sets archived_at', async () => {
  const sb = makeClient([], { id: 't1', archived_at: '2026-06-20' })
  await archiveTopic(sb, 't1')
  expect(sb._chain.update).toHaveBeenCalledWith(expect.objectContaining({ archived_at: expect.any(String) }))
})

test('unarchiveTopic clears archived_at', async () => {
  const sb = makeClient([], { id: 't1', archived_at: null })
  await unarchiveTopic(sb, 't1')
  expect(sb._chain.update).toHaveBeenCalledWith({ archived_at: null })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/lib/db/topics.test.js
```

Expected: FAIL — functions not found.

- [ ] **Step 4: Update `src/lib/db/topics.js`**

Replace the entire file content (read it first in Step 1):

```js
export async function listTopics(supabase) {
  const { data, error } = await supabase
    .from('topics')
    .select('*, entries!entries_topic_id_fkey(count)')
    .is('entries.deleted_at', null)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((t) => ({ ...t, entry_count: t.entries?.[0]?.count ?? 0 }))
}

export async function listDeletedTopics(supabase) {
  const { data, error } = await supabase
    .from('topics')
    .select('*, entries!entries_topic_id_fkey(count)')
    .is('entries.deleted_at', null)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((t) => ({ ...t, entry_count: t.entries?.[0]?.count ?? 0 }))
}

export async function getTopicByName(supabase, name) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('name', name)
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function createTopic(supabase, name) {
  const { data, error } = await supabase
    .from('topics')
    .insert({ name: String(name).slice(0, 120) })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTopicIcon(supabase, topicId, icon) {
  const { data, error } = await supabase
    .from('topics')
    .update({ icon: icon || null })
    .eq('id', topicId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

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

export async function archiveTopic(supabase, id) {
  const { data, error } = await supabase
    .from('topics')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function unarchiveTopic(supabase, id) {
  const { data, error } = await supabase
    .from('topics')
    .update({ archived_at: null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function softDeleteTopic(supabase, id) {
  const now = new Date().toISOString()
  // Soft-delete all non-deleted entries in this topic first
  await supabase
    .from('entries')
    .update({ deleted_at: now })
    .eq('topic_id', id)
    .is('deleted_at', null)
  // Then soft-delete the topic
  const { error } = await supabase
    .from('topics')
    .update({ deleted_at: now })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function restoreDeletedTopic(supabase, id) {
  // Restore all entries belonging to this topic
  await supabase
    .from('entries')
    .update({ deleted_at: null })
    .eq('topic_id', id)
    .not('deleted_at', 'is', null)
  // Restore the topic
  const { error } = await supabase
    .from('topics')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/lib/db/topics.test.js
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/topics.js src/lib/db/topics.test.js
git commit -m "feat: topic DB functions — archive, unarchive, soft-delete, restore"
```

---

## Task 3: useTopics hook

**Files:**
- Modify: `src/hooks/useTopics.js`
- Modify: `src/hooks/useTopics.test.js`

**Interfaces:**
- Consumes: nothing new
- Produces (new exports from hook):
  - `activeTopics` — `Topic[]` topics where `archived_at == null`
  - `archivedTopics` — `Topic[]` topics where `archived_at != null`
  - `applyArchiveTopic(id, updatedTopic)` — updates `topics` state in place
  - `applyUnarchiveTopic(id, updatedTopic)` — updates `topics` state in place
  - `applyDeleteTopic(id)` — removes topic from `topics` state
  - `applyRestoreDeletedTopic(topic)` — adds topic back to `topics` state

- [ ] **Step 1: Write failing test**

Add to `src/hooks/useTopics.test.js` (read the file first):

```js
import { renderHook, act } from '@testing-library/react'
import { useTopics } from './useTopics.js'

const active = { id: '1', name: 'AI', archived_at: null }
const archived = { id: '2', name: 'Old', archived_at: '2026-01-01' }

test('activeTopics excludes archived', () => {
  const { result } = renderHook(() => useTopics())
  act(() => result.current.setTopics([active, archived]))
  expect(result.current.activeTopics.map(t => t.id)).toEqual(['1'])
})

test('archivedTopics includes only archived', () => {
  const { result } = renderHook(() => useTopics())
  act(() => result.current.setTopics([active, archived]))
  expect(result.current.archivedTopics.map(t => t.id)).toEqual(['2'])
})

test('applyArchiveTopic updates topic in state', () => {
  const { result } = renderHook(() => useTopics())
  act(() => result.current.setTopics([active]))
  const updated = { ...active, archived_at: '2026-06-20' }
  act(() => result.current.applyArchiveTopic('1', updated))
  expect(result.current.archivedTopics[0].id).toBe('1')
})

test('applyDeleteTopic removes from state', () => {
  const { result } = renderHook(() => useTopics())
  act(() => result.current.setTopics([active]))
  act(() => result.current.applyDeleteTopic('1'))
  expect(result.current.topics).toHaveLength(0)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/hooks/useTopics.test.js
```

Expected: FAIL — `activeTopics`, `applyArchiveTopic` not exported.

- [ ] **Step 3: Update `src/hooks/useTopics.js`**

```js
import { useState, useMemo } from 'react'

export function useTopics() {
  const [topics, setTopics] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [inboxCount, setInboxCount] = useState(0)

  const selectedTopic = useMemo(() => topics.find(t => t.id === selectedId) || null, [topics, selectedId])
  const inboxTopic = useMemo(() => topics.find(t => t.name === 'Inbox'), [topics])
  const activeTopics = useMemo(() => topics.filter(t => t.name === 'Inbox' || !t.archived_at), [topics])
  const archivedTopics = useMemo(() => topics.filter(t => t.name !== 'Inbox' && t.archived_at), [topics])

  function applyAddTopic(topic) {
    setTopics(prev => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedId(topic.id)
  }

  function applyArchiveTopic(id, updated) {
    setTopics(prev => prev.map(t => t.id === id ? updated : t))
  }

  function applyUnarchiveTopic(id, updated) {
    setTopics(prev => prev.map(t => t.id === id ? updated : t))
  }

  function applyDeleteTopic(id) {
    setTopics(prev => prev.filter(t => t.id !== id))
  }

  function applyRestoreDeletedTopic(topic) {
    setTopics(prev => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)))
  }

  return {
    topics, setTopics,
    activeTopics, archivedTopics,
    selectedId, setSelectedId,
    inboxCount, setInboxCount,
    selectedTopic, inboxTopic,
    applyAddTopic,
    applyArchiveTopic, applyUnarchiveTopic,
    applyDeleteTopic, applyRestoreDeletedTopic,
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/hooks/useTopics.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTopics.js src/hooks/useTopics.test.js
git commit -m "feat: useTopics — activeTopics, archivedTopics, archive/delete/restore apply fns"
```

---

## Task 4: CSS

**Files:**
- Modify: `src/styles.css`

Append at the end of the file:

- [ ] **Step 1: Append CSS**

```css
/* ── Topic lifecycle — three-dot menu ───────────────────────────────────────── */
.topic-item {
  position: relative;
  display: flex;
  align-items: center;
}
.topic-item > button:first-child {
  flex: 1;
  min-width: 0;
}
.topic-menu-btn {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 2px 4px;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
}
.topic-item:hover .topic-menu-btn,
.topic-menu-btn:focus {
  display: flex;
  align-items: center;
}
.topic-menu-btn:hover { color: var(--text); background: var(--surface-2); }

.topic-menu-popover {
  position: absolute;
  left: 100%;
  top: 0;
  z-index: 200;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.topic-menu-item {
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: var(--text-sm);
  padding: 6px 10px;
  border-radius: 5px;
  color: var(--text);
  width: 100%;
}
.topic-menu-item:hover { background: var(--surface-2); }
.topic-menu-item.danger { color: var(--danger); }
.topic-menu-item.danger:hover { background: #FEE2E2; }

/* ── Archived topics section ─────────────────────────────────────────────────── */
.topics-archived-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 6px 4px 4px;
  width: 100%;
  margin-top: 8px;
}
.topics-archived-toggle:hover { color: var(--text); }
.topics-archived-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}
.topic-archived-btn {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--muted);
  padding: 5px 8px;
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topic-archived-btn:hover { background: var(--surface-2); color: var(--text); }
.topic-archived-btn.selected { background: var(--accent-weak); color: var(--accent); }

/* ── Trash — deleted topics section ─────────────────────────────────────────── */
.trash-topics-section { margin-bottom: 28px; }
.trash-topic-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 8px;
}
.trash-topic-name { font-weight: 500; font-size: var(--text-sm); }
.trash-topic-meta { font-size: var(--text-xs); color: var(--muted); margin-top: 2px; }
```

- [ ] **Step 2: Run tests (CSS-only, quick check)**

```bash
npm test -- --run
```

Expected: same pass/fail as before.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: topic lifecycle CSS — three-dot menu, archived section, trash topics"
```

---

## Task 5: TopicList with menu + archived section

**Files:**
- Modify: `src/components/TopicList.jsx`
- Modify: `src/components/TopicList.test.jsx`

**Interfaces:**
- Consumes (new props):
  - `activeTopics: Topic[]` — active non-inbox topics (Inbox handled separately as before)
  - `archivedTopics: Topic[]` — archived topics
  - `onArchive(id)` — callback
  - `onUnarchive(id)` — callback
  - `onDeleteTopic(id)` — callback
- Note: `topics` prop is still passed for backward compat; `activeTopics`/`archivedTopics` are derived from the hook and passed explicitly.

- [ ] **Step 1: Write failing tests**

Read `src/components/TopicList.test.jsx` first, then add:

```jsx
// additions to src/components/TopicList.test.jsx
import userEvent from '@testing-library/user-event'

const baseProps = {
  topics: [],
  activeTopics: [{ id: 'a1', name: 'AI', archived_at: null }],
  archivedTopics: [{ id: 'a2', name: 'Old Project', archived_at: '2026-01-01' }],
  selectedId: null,
  onSelect: vi.fn(),
  onAdd: vi.fn(),
  sidebarCollapsed: false,
  onArchive: vi.fn(),
  onUnarchive: vi.fn(),
  onDeleteTopic: vi.fn(),
}

test('shows three-dot menu button on hover', async () => {
  render(<TopicList {...baseProps} />)
  const topicBtn = screen.getByRole('button', { name: 'AI' })
  await userEvent.hover(topicBtn.closest('.topic-item'))
  expect(screen.getByRole('button', { name: /topic menu/i })).toBeInTheDocument()
})

test('clicking archive in menu calls onArchive', async () => {
  const onArchive = vi.fn()
  render(<TopicList {...baseProps} onArchive={onArchive} />)
  await userEvent.hover(screen.getByText('AI').closest('.topic-item'))
  await userEvent.click(screen.getByRole('button', { name: /topic menu/i }))
  await userEvent.click(screen.getByRole('button', { name: /archive/i }))
  expect(onArchive).toHaveBeenCalledWith('a1')
})

test('archived section is collapsible and shows archived topics', async () => {
  render(<TopicList {...baseProps} />)
  expect(screen.queryByText('Old Project')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /archived/i }))
  expect(screen.getByText('Old Project')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/TopicList.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Replace `src/components/TopicList.jsx`**

```jsx
import { useState, useRef, useEffect } from 'react'
import { Inbox, MoreVertical, ChevronDown, ChevronRight } from 'lucide-react'

export default function TopicList({
  topics,
  activeTopics,
  archivedTopics,
  selectedId,
  onSelect,
  onAdd,
  sidebarCollapsed,
  onArchive,
  onUnarchive,
  onDeleteTopic,
}) {
  const [name, setName] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [archiveSectionOpen, setArchiveSectionOpen] = useState(() => {
    try { return localStorage.getItem('medialog_archive_section_open') === 'true' } catch { return false }
  })
  const menuRef = useRef(null)

  // Resolve active/archived: fall back to splitting `topics` if new props not passed
  const allActive = activeTopics ?? (topics ?? []).filter(t => t.name !== 'Inbox' && !t.archived_at)
  const allArchived = archivedTopics ?? (topics ?? []).filter(t => t.name !== 'Inbox' && t.archived_at)

  const inboxTopic = (topics ?? []).find((t) => t.name === 'Inbox')
    ?? allActive.find((t) => t.name === 'Inbox')

  const activeNonInbox = allActive
    .filter(t => t.name !== 'Inbox')
    .sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleArchiveSection() {
    const next = !archiveSectionOpen
    setArchiveSectionOpen(next)
    try { localStorage.setItem('medialog_archive_section_open', next) } catch {}
  }

  function handleAdd(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <nav>
      <p className="section-label">Topics</p>
      <ul className="topics">
        {inboxTopic && (
          <li key={inboxTopic.id}>
            <button
              className={inboxTopic.id === selectedId ? 'selected topic-inbox-btn' : 'topic-inbox-btn'}
              onClick={() => onSelect(inboxTopic.id)}
              title="Inbox"
            >
              <Inbox size={14} className="topic-inbox-icon" />
              {!sidebarCollapsed && <span>{inboxTopic.name}</span>}
              {sidebarCollapsed && <span>{inboxTopic.name.slice(0, 2).toUpperCase()}</span>}
            </button>
          </li>
        )}
        {inboxTopic && activeNonInbox.length > 0 && <li><hr className="topic-divider" /></li>}

        {activeNonInbox.map((t) => (
          <li key={t.id} className="topic-item" ref={openMenuId === t.id ? menuRef : null}>
            <button
              className={t.id === selectedId ? 'selected' : ''}
              onClick={() => onSelect(t.id)}
              title={t.name}
            >
              {sidebarCollapsed ? t.name.slice(0, 2).toUpperCase() : t.name}
            </button>
            {!sidebarCollapsed && (
              <button
                className="topic-menu-btn"
                aria-label="topic menu"
                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t.id ? null : t.id) }}
              >
                <MoreVertical size={12} />
              </button>
            )}
            {openMenuId === t.id && (
              <div className="topic-menu-popover">
                <button className="topic-menu-item" onClick={() => { onArchive?.(t.id); setOpenMenuId(null) }}>
                  Archive
                </button>
                <button className="topic-menu-item danger" onClick={() => { onDeleteTopic?.(t.id); setOpenMenuId(null) }}>
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form className="topic-add" onSubmit={handleAdd}>
        <input
          placeholder="new topic"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      {allArchived.length > 0 && (
        <>
          <button className="topics-archived-toggle" onClick={toggleArchiveSection}>
            {archiveSectionOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {!sidebarCollapsed && 'Archived'}
          </button>
          {archiveSectionOpen && (
            <ul className="topics-archived-list">
              {allArchived.sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                <li key={t.id} className="topic-item" ref={openMenuId === t.id ? menuRef : null}>
                  <button
                    className={`topic-archived-btn${t.id === selectedId ? ' selected' : ''}`}
                    onClick={() => onSelect(t.id)}
                    title={t.name}
                  >
                    {sidebarCollapsed ? t.name.slice(0, 2).toUpperCase() : t.name}
                  </button>
                  {!sidebarCollapsed && (
                    <button
                      className="topic-menu-btn"
                      aria-label="topic menu"
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t.id ? null : t.id) }}
                    >
                      <MoreVertical size={12} />
                    </button>
                  )}
                  {openMenuId === t.id && (
                    <div className="topic-menu-popover">
                      <button className="topic-menu-item" onClick={() => { onUnarchive?.(t.id); setOpenMenuId(null) }}>
                        Unarchive
                      </button>
                      <button className="topic-menu-item danger" onClick={() => { onDeleteTopic?.(t.id); setOpenMenuId(null) }}>
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </nav>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/TopicList.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Run full suite**

```bash
npm test -- --run
```

Expected: same pass/fail as before.

- [ ] **Step 6: Commit**

```bash
git add src/components/TopicList.jsx src/components/TopicList.test.jsx
git commit -m "feat: topic sidebar — three-dot menu (archive/delete) + archived section"
```

---

## Task 6: TrashView — deleted topics section

**Files:**
- Modify: `src/components/TrashView.jsx`
- Modify: `src/components/TrashView.test.jsx` (create if missing)

**Interfaces:**
- Consumes (new props):
  - `deletedTopics: Topic[]` — topics with `deleted_at != null`, each has `.entry_count`
  - `onRestoreTopic(id)` — callback

- [ ] **Step 1: Write failing test**

Create `src/components/TrashView.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import TrashView from './TrashView.jsx'

const noopProps = { entries: [], onRestore: vi.fn(), onEmptyTrash: vi.fn(), deletedTopics: [], onRestoreTopic: vi.fn() }

test('shows empty state when no entries or deleted topics', () => {
  render(<TrashView {...noopProps} />)
  expect(screen.getByText(/trash is empty/i)).toBeInTheDocument()
})

test('shows deleted topic with entry count and restore button', () => {
  const deletedTopics = [{ id: 't1', name: 'Old Notes', deleted_at: '2026-06-01', entry_count: 5 }]
  render(<TrashView {...noopProps} deletedTopics={deletedTopics} />)
  expect(screen.getByText('Old Notes')).toBeInTheDocument()
  expect(screen.getByText(/5 entries/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument()
})

test('clicking restore calls onRestoreTopic', async () => {
  const onRestoreTopic = vi.fn()
  const deletedTopics = [{ id: 't1', name: 'Old Notes', deleted_at: '2026-06-01', entry_count: 3 }]
  render(<TrashView {...noopProps} deletedTopics={deletedTopics} onRestoreTopic={onRestoreTopic} />)
  await userEvent.click(screen.getByRole('button', { name: /restore/i }))
  expect(onRestoreTopic).toHaveBeenCalledWith('t1')
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/TrashView.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Update `src/components/TrashView.jsx`**

```jsx
import { useState } from 'react'
import ConfirmModal from './ConfirmModal.jsx'
import EmptyState from './EmptyState.jsx'

export default function TrashView({ entries, onRestore, onEmptyTrash, deletedTopics = [], onRestoreTopic }) {
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const isEmpty = !entries.length && !deletedTopics.length
  if (isEmpty) return <EmptyState message="Trash is empty." />

  return (
    <div className="trash-view">
      {deletedTopics.length > 0 && (
        <div className="trash-topics-section">
          <p className="section-label" style={{ marginBottom: 10 }}>Deleted Topics</p>
          {deletedTopics.map((t) => (
            <div key={t.id} className="trash-topic-card">
              <div>
                <div className="trash-topic-name">{t.name}</div>
                <div className="trash-topic-meta">
                  {t.entry_count} {t.entry_count === 1 ? 'entry' : 'entries'} · deleted {new Date(t.deleted_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => onRestoreTopic?.(t.id)}>Restore</button>
            </div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <p className="section-label" style={{ margin: 0 }}>{entries.length} item{entries.length !== 1 ? 's' : ''} in trash</p>
            <button className="btn-danger" onClick={() => setConfirmEmpty(true)}>Empty Trash</button>
          </div>

          {entries.map((entry) => (
            <div key={entry.id} className="card">
              <div className="card-body">
                {entry.url && (
                  <a href={entry.url} target="_blank" rel="noreferrer" className="card-title">
                    {entry.title || entry.url}
                  </a>
                )}
                {entry.note && (
                  <p className="note" style={{ margin: '0.5rem 0' }}>
                    {entry.note.slice(0, 300)}{entry.note.length > 300 ? '…' : ''}
                  </p>
                )}
              </div>
              <div className="card-meta">
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  Deleted {new Date(entry.deleted_at).toLocaleDateString()}
                </span>
                <div className="card-actions">
                  <button onClick={() => onRestore(entry.id)}>Restore</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {confirmEmpty && (
        <ConfirmModal
          message="Permanently delete all items in trash? This cannot be undone."
          confirmLabel="Empty Trash"
          onConfirm={() => { setConfirmEmpty(false); onEmptyTrash() }}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/TrashView.test.jsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TrashView.jsx src/components/TrashView.test.jsx
git commit -m "feat: TrashView shows deleted topics with entry count and restore"
```

---

## Task 7: Wire everything in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Read the relevant sections of App.jsx**

Read `src/App.jsx` lines 1–70 (imports + Workspace state), then search for `handleDelete`, `handleRestore`, `loadTrash`, `<TopicList`, `<TrashView`.

- [ ] **Step 2: Add imports**

In the `import { listTopics, createTopic, getTopicByName }` line, also import the new functions:

```js
import { listTopics, createTopic, getTopicByName, archiveTopic, unarchiveTopic, softDeleteTopic, restoreDeletedTopic, listDeletedTopics } from './lib/db/topics.js'
```

- [ ] **Step 3: Destructure new hook values**

Find the `useTopics()` destructure line and add `activeTopics`, `archivedTopics`, and the new apply functions:

```js
const {
  topics, setTopics,
  activeTopics, archivedTopics,
  selectedId, setSelectedId,
  inboxCount, setInboxCount,
  selectedTopic, inboxTopic,
  applyAddTopic,
  applyArchiveTopic, applyUnarchiveTopic,
  applyDeleteTopic, applyRestoreDeletedTopic,
} = useTopics()
```

- [ ] **Step 4: Add deletedTopics state**

After the `useTrash()` line, add:

```js
const [deletedTopics, setDeletedTopics] = useState([])
```

- [ ] **Step 5: Add handlers**

Add these four handlers near the existing `handleDelete` / `handleRestore` block:

```js
async function handleArchiveTopic(id) {
  const updated = await archiveTopic(supabase, id)
  applyArchiveTopic(id, updated)
}

async function handleUnarchiveTopic(id) {
  const updated = await unarchiveTopic(supabase, id)
  applyUnarchiveTopic(id, updated)
}

async function handleDeleteTopic(id) {
  await softDeleteTopic(supabase, id)
  applyDeleteTopic(id)
  if (selectedId === id) setSelectedId(inboxTopic?.id ?? null)
  addToast('Topic moved to trash', 'info')
}

async function handleRestoreTopic(id) {
  await restoreDeletedTopic(supabase, id)
  const topic = deletedTopics.find(t => t.id === id)
  setDeletedTopics(prev => prev.filter(t => t.id !== id))
  if (topic) applyRestoreDeletedTopic({ ...topic, deleted_at: null })
  addToast('Topic restored', 'success')
}
```

- [ ] **Step 6: Load deleted topics when opening Trash**

Find `loadTrash` function (which calls `setTrashEntries`) and update it:

```js
async function loadTrash() {
  const [entries, topics] = await Promise.all([
    listTrashedEntries(supabase),
    listDeletedTopics(supabase),
  ])
  setTrashEntries(entries)
  setDeletedTopics(topics)
}
```

- [ ] **Step 7: Pass new props to TopicList**

Find `<TopicList` in the JSX and add the new props:

```jsx
<TopicList
  topics={topics}
  activeTopics={activeTopics}
  archivedTopics={archivedTopics}
  selectedId={selectedId}
  onSelect={handleSelect}
  onAdd={handleAddTopic}
  sidebarCollapsed={sidebarCollapsed}
  onArchive={handleArchiveTopic}
  onUnarchive={handleUnarchiveTopic}
  onDeleteTopic={handleDeleteTopic}
/>
```

- [ ] **Step 8: Pass new props to TrashView**

Find `<TrashView` and add:

```jsx
<TrashView
  entries={trashEntries}
  onRestore={handleRestore}
  onEmptyTrash={handleEmptyTrash}
  deletedTopics={deletedTopics}
  onRestoreTopic={handleRestoreTopic}
/>
```

- [ ] **Step 9: Run full test suite**

```bash
npm test -- --run
```

Expected: same pass/fail as before (no new failures).

- [ ] **Step 10: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire topic archive/delete/restore in App — sidebar menu + trash"
```

---

---

## Future: Instagram Reels Ingestion (not in this plan)

When ready to implement: user DMs a Reel link to a configured alt account → a cron edge function (`fetch-instagram`) polls the DM inbox using an `INSTAGRAM_SESSION_ID` cookie (same pattern as `TWITTER_AUTH_TOKEN`), fetches the Reel caption via the private API, summarizes with Claude Haiku, and creates an entry in a dedicated "Reels" topic. Key secrets needed: `INSTAGRAM_SESSION_ID`, `ANTHROPIC_API_KEY`. Video transcription (for non-talking-face reels) would be a v2 addition via Whisper.

---

## Done Criteria

- `npm test -- --run` passes all suites
- Each topic in the sidebar shows a `⋯` button on hover → Archive / Delete
- Archived topics disappear from main list, appear in collapsible "Archived" section at bottom of sidebar
- Archived section persists open/closed state across page reloads
- Deleted topics appear in Trash with entry count + Restore button
- Restoring a deleted topic brings back the topic and all its entries to the same topic
- Navigating to a deleted topic auto-redirects to Inbox
