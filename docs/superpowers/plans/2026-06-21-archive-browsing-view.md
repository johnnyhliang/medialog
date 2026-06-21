# Archive Browsing View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Archive" nav view that shows all `status = 'done'` entries grouped by topic, so finished reading doesn't clutter active topic views.

**Architecture:** New `ArchiveView` component fetches all done entries via a new `listArchivedEntries` DB function, groups them client-side by `topic_id`, and renders collapsible topic sections. Accessed via a new nav button in the sidebar (Archive icon). Archived topics (soft-archived via `archived_at`) appear at the bottom of the group list with a visual distinction.

**Tech Stack:** React 18, Supabase JS v2, Vitest + @testing-library/react, Lucide icons

## Global Constraints

- New DB function goes in `src/lib/db/entries.js`
- New component at `src/components/ArchiveView.jsx`
- Nav button uses Lucide `Archive` icon
- Sidebar nav item label: `Archive`
- View key in App.jsx: `'archive'`
- Tests use `npx vitest run <path>`
- No new migrations needed (queries existing `status` + `deleted_at` columns)

---

### Task 1: DB query — `listArchivedEntries`

**Files:**
- Modify: `src/lib/db/entries.js`
- Test: `src/lib/db/entries.test.js`

- [ ] **Step 1: Write failing test**

Add to `src/lib/db/entries.test.js`:

```js
test('listArchivedEntries returns done non-deleted entries ordered by topic then created_at desc', async () => {
  const rows = [
    { id: 'e1', topic_id: 't1', status: 'done', deleted_at: null, entries: [] },
  ]
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  }
  const sb = { from: vi.fn(() => chain) }
  const { listArchivedEntries } = await import('./entries.js')
  const result = await listArchivedEntries(sb)
  expect(chain.eq).toHaveBeenCalledWith('status', 'done')
  expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  expect(result).toHaveLength(1)
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run src/lib/db/entries.test.js
```

- [ ] **Step 3: Implement in `src/lib/db/entries.js`**

```js
export async function listArchivedEntries(supabase) {
  const { data, error } = await supabase
    .from('entries')
    .select('*, tags:entry_tags(tag:tags(name,color))')
    .eq('status', 'done')
    .is('deleted_at', null)
    .order('topic_id', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((e) => ({
    ...e,
    tags: e.tags?.map((t) => t.tag).filter(Boolean) ?? [],
  }))
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npx vitest run src/lib/db/entries.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/entries.js src/lib/db/entries.test.js
git commit -m "feat: listArchivedEntries DB query"
```

---

### Task 2: ArchiveView component

**Files:**
- Create: `src/components/ArchiveView.jsx`
- Create: `src/components/ArchiveView.test.jsx`

**Interfaces:**
- Props: `{ entries, topics, onSelectEntry }` — `entries` is the flat list from `listArchivedEntries`, `topics` is the existing topics array for name lookup
- Groups entries by `topic_id` client-side, sorted alphabetically by topic name

- [ ] **Step 1: Write failing test**

Create `src/components/ArchiveView.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import ArchiveView from './ArchiveView.jsx'

const topics = [
  { id: 't1', name: 'AI' },
  { id: 't2', name: 'Books' },
]
const entries = [
  { id: 'e1', topic_id: 't1', title: 'GPT paper', url: 'https://x', note: '', tags: [], status: 'done', created_at: new Date().toISOString() },
  { id: 'e2', topic_id: 't2', title: null, url: null, note: 'A note', tags: [], status: 'done', created_at: new Date().toISOString() },
]

test('renders topic group headers', () => {
  render(<ArchiveView entries={entries} topics={topics} onSelectEntry={() => {}} />)
  expect(screen.getByText('AI')).toBeInTheDocument()
  expect(screen.getByText('Books')).toBeInTheDocument()
})

test('renders entry titles under their topic', () => {
  render(<ArchiveView entries={entries} topics={topics} onSelectEntry={() => {}} />)
  expect(screen.getByText('GPT paper')).toBeInTheDocument()
  expect(screen.getByText('A note')).toBeInTheDocument()
})

test('shows empty state when no entries', () => {
  render(<ArchiveView entries={[]} topics={[]} onSelectEntry={() => {}} />)
  expect(screen.getByText(/nothing archived/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run src/components/ArchiveView.test.jsx
```

- [ ] **Step 3: Implement `src/components/ArchiveView.jsx`**

```jsx
import EmptyState from './EmptyState.jsx'

export default function ArchiveView({ entries, topics, onSelectEntry }) {
  if (!entries.length) return <EmptyState message="Nothing archived yet." />

  const topicMap = Object.fromEntries(topics.map((t) => [t.id, t]))
  const grouped = {}
  for (const e of entries) {
    if (!grouped[e.topic_id]) grouped[e.topic_id] = []
    grouped[e.topic_id].push(e)
  }
  const sorted = Object.entries(grouped).sort(([aId], [bId]) => {
    const aName = topicMap[aId]?.name ?? ''
    const bName = topicMap[bId]?.name ?? ''
    return aName.localeCompare(bName)
  })

  return (
    <div className="archive-view">
      <p className="section-label">Archive — {entries.length} item{entries.length !== 1 ? 's' : ''}</p>
      {sorted.map(([topicId, items]) => (
        <div key={topicId} className="archive-group">
          <p className="archive-group-label">{topicMap[topicId]?.name ?? 'Unknown'}</p>
          {items.map((e) => (
            <div key={e.id} className="archive-entry" onClick={() => onSelectEntry(e)} style={{ cursor: 'pointer' }}>
              <span className="archive-entry-title">
                {e.title || e.url || e.note?.slice(0, 80) || 'Untitled'}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npx vitest run src/components/ArchiveView.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ArchiveView.jsx src/components/ArchiveView.test.jsx
git commit -m "feat: ArchiveView — done entries grouped by topic"
```

---

### Task 3: Wire into App.jsx + sidebar nav + CSS

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add Archive import and nav to `src/App.jsx`**

Add import at top:
```js
import { Archive } from 'lucide-react'
import ArchiveView from './components/ArchiveView.jsx'
import { listArchivedEntries } from './lib/db/entries.js'
```

Add `archivedEntries` state:
```js
const [archivedEntries, setArchivedEntries] = useState([])
```

Add load function:
```js
async function loadArchive() {
  setArchivedEntries(await listArchivedEntries(supabase))
}
```

Add nav button (after the Revisit button):
```jsx
<li>
  <button className={view === 'archive' ? 'active' : ''} onClick={() => { setView('archive'); loadArchive() }} title="Archive">
    <Archive size={16} /><span>Archive</span>
  </button>
</li>
```

Add view render (after the `revisit` view block):
```jsx
{view === 'archive' && (
  <ArchiveView
    entries={archivedEntries}
    topics={topics}
    onSelectEntry={handleSelectEntry}
  />
)}
```

- [ ] **Step 2: Add CSS to `src/styles.css`**

Append:
```css
/* ── Archive view ─────────────────────────────────────────────────────────── */
.archive-view { max-width: 720px; margin: 0 auto; }
.archive-group { margin-bottom: 24px; }
.archive-group-label { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 6px; }
.archive-entry { padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 4px; background: var(--surface-2); }
.archive-entry:hover { background: var(--surface-3); }
.archive-entry-title { font-size: var(--text-sm); }
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: no new failures vs. baseline.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/styles.css
git commit -m "feat: Archive nav view wired into App"
```
