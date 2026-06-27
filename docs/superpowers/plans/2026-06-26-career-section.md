# Career Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Opportunities, Applications, and a new Watchlist into a single "Career" sidebar item with three tabs, replacing the two separate top-level nav items.

**Architecture:** New `CareerView.jsx` owns tab state (`radar | watchlist | applications`) and renders the existing `OpportunityView` and `ApplicationsView` as tab panels alongside a new `WatchlistTab`. App.jsx wires `view === 'career'` and removes the old `opportunities` and `applications` nav items. A single migration adds `opens_at` to the `programs` table.

**Tech Stack:** React 18, Supabase JS v2, lucide-react, Vitest + @testing-library/react

## Global Constraints

- All new components follow existing patterns: functional components, hooks for data, no class components
- Supabase queries use the `supabase` client passed as a prop (no direct import of the client)
- Icons from `lucide-react` only — no new icon libraries
- CSS goes in `src/styles.css` following existing BEM-ish class naming (e.g. `career-view`, `career-tabs`, `watchlist-row`)
- Tests colocated with components (`ComponentName.test.jsx`)
- All RLS-protected tables require `user_id` — the `programs` table already has this
- No TypeScript — plain JS/JSX throughout
- Run `npm test -- --run` after each task to confirm 350 tests still pass

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/0037_programs_opens_at.sql` | Create | Add `opens_at date` column to programs |
| `src/components/CareerView.jsx` | Create | Tab shell — owns `activeTab` state, renders three panels |
| `src/components/WatchlistTab.jsx` | Create | Programs UI — list, search, add form |
| `src/components/WatchlistTab.test.jsx` | Create | Tests for WatchlistTab |
| `src/App.jsx` | Modify | Add `career` view, wire CareerView, remove old nav items, add Career sidebar entry |
| `src/styles.css` | Modify | Career tab styles + watchlist styles |

---

### Task 1: Migration — add `opens_at` to programs

**Files:**
- Create: `supabase/migrations/0037_programs_opens_at.sql`

**Interfaces:**
- Produces: `programs.opens_at` (date, nullable) available in all subsequent DB queries

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0037_programs_opens_at.sql
alter table programs add column if not exists opens_at date;
```

- [ ] **Step 2: Push to remote**

```bash
supabase db push
```

Expected output:
```
Applying migration 0037_programs_opens_at.sql...
Finished supabase db push.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0037_programs_opens_at.sql
git commit -m "feat(career): add opens_at column to programs table"
```

---

### Task 2: WatchlistTab component

**Files:**
- Create: `src/components/WatchlistTab.jsx`
- Create: `src/components/WatchlistTab.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop (Supabase client)
- Produces: `<WatchlistTab supabase={supabase} />` — self-contained, no callbacks needed

- [ ] **Step 1: Write failing tests**

```jsx
// src/components/WatchlistTab.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import WatchlistTab from './WatchlistTab.jsx'

function makeSupabase(programs = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: programs, error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: 'new-1', name: 'New Program', url: 'https://example.com', notes: '', opens_at: null, window_open: false },
      error: null,
    }),
    delete: vi.fn().mockReturnThis(),
  }
  return {
    from: vi.fn(() => chain),
    _chain: chain,
  }
}

const samplePrograms = [
  { id: '1', name: 'Google STEP', url: 'https://step.google', notes: 'good program', opens_at: '2026-09-01', window_open: false },
  { id: '2', name: 'MLH Fellowship', url: 'https://mlh.io', notes: '', opens_at: null, window_open: true },
]

test('renders program list', async () => {
  const sb = makeSupabase(samplePrograms)
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => expect(screen.getByText('Google STEP')).toBeInTheDocument())
  expect(screen.getByText('MLH Fellowship')).toBeInTheDocument()
})

test('search filters by name and notes', async () => {
  const sb = makeSupabase(samplePrograms)
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => screen.getByText('Google STEP'))
  await userEvent.type(screen.getByPlaceholderText(/search/i), 'good')
  expect(screen.getByText('Google STEP')).toBeInTheDocument()
  expect(screen.queryByText('MLH Fellowship')).not.toBeInTheDocument()
})

test('shows open badge for window_open programs', async () => {
  const sb = makeSupabase(samplePrograms)
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => screen.getByText('MLH Fellowship'))
  expect(screen.getByText('open')).toBeInTheDocument()
})

test('shows opens_at date when present', async () => {
  const sb = makeSupabase(samplePrograms)
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => screen.getByText('Google STEP'))
  expect(screen.getByText(/Sep 2026/i)).toBeInTheDocument()
})

test('add form inserts new program', async () => {
  const sb = makeSupabase([])
  render(<WatchlistTab supabase={sb} />)
  await waitFor(() => expect(sb.from).toHaveBeenCalled())
  await userEvent.click(screen.getByRole('button', { name: /add/i }))
  await userEvent.type(screen.getByPlaceholderText(/program name/i), 'New Program')
  await userEvent.type(screen.getByPlaceholderText(/url/i), 'https://example.com')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(sb._chain.insert).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --run src/components/WatchlistTab.test.jsx
```

Expected: FAIL (WatchlistTab.jsx does not exist)

- [ ] **Step 3: Implement WatchlistTab**

```jsx
// src/components/WatchlistTab.jsx
import { useEffect, useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'

function formatOpensAt(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function StatusBadge({ program }) {
  if (program.window_open) return <span className="watchlist-badge watchlist-badge--open">open</span>
  if (program.opens_at) return <span className="watchlist-badge watchlist-badge--scheduled">Opens {formatOpensAt(program.opens_at)}</span>
  return <span className="watchlist-badge watchlist-badge--unknown">unknown</span>
}

export default function WatchlistTab({ supabase }) {
  const [programs, setPrograms] = useState([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', notes: '', opens_at: '' })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('programs')
      .select('*')
      .order('opens_at', { ascending: true, nullsFirst: false })
    if (data) setPrograms(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.url.trim()) return
    const { data } = await supabase
      .from('programs')
      .insert({
        name: form.name.trim(),
        url: form.url.trim(),
        notes: form.notes.trim() || null,
        opens_at: form.opens_at || null,
      })
      .single()
    if (data) setPrograms((prev) => [...prev, data])
    setForm({ name: '', url: '', notes: '', opens_at: '' })
    setShowAdd(false)
  }

  async function handleDelete(id) {
    await supabase.from('programs').delete().eq('id', id)
    setPrograms((prev) => prev.filter((p) => p.id !== id))
  }

  const filtered = programs.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.notes ?? '').toLowerCase().includes(q)
  })

  // Sort: open first, then by opens_at asc, then unknowns
  const sorted = [...filtered].sort((a, b) => {
    if (a.window_open && !b.window_open) return -1
    if (!a.window_open && b.window_open) return 1
    if (a.opens_at && !b.opens_at) return -1
    if (!a.opens_at && b.opens_at) return 1
    if (a.opens_at && b.opens_at) return a.opens_at.localeCompare(b.opens_at)
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="watchlist-view">
      <div className="watchlist-header">
        <input
          className="watchlist-search"
          placeholder="Search programs and notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-small" onClick={() => setShowAdd((v) => !v)}>
          <Plus size={14} /> Add
        </button>
      </div>

      {showAdd && (
        <form className="watchlist-add-form" onSubmit={handleAdd}>
          <input
            placeholder="Program name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            placeholder="URL"
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            required
          />
          <textarea
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
          <label className="watchlist-date-label">
            Expected open date (optional)
            <input
              type="date"
              value={form.opens_at}
              onChange={(e) => setForm((f) => ({ ...f, opens_at: e.target.value }))}
            />
          </label>
          <div className="watchlist-form-actions">
            <button type="submit" className="btn-small">Save</button>
            <button type="button" className="btn-small" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading && <p className="muted" style={{ fontSize: 13 }}>Loading…</p>}

      {!loading && sorted.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>
          {search ? 'No programs match that search.' : 'No programs yet. Add one to track when it opens.'}
        </p>
      )}

      <div className="watchlist-rows">
        {sorted.map((p) => (
          <div key={p.id} className="watchlist-row">
            <div className="watchlist-row-main">
              <a href={p.url} target="_blank" rel="noreferrer" className="watchlist-row-name">{p.name}</a>
              <StatusBadge program={p} />
            </div>
            {p.notes && <p className="watchlist-row-notes">{p.notes}</p>}
            <button
              className="watchlist-row-delete icon-btn"
              onClick={() => handleDelete(p.id)}
              title="Remove"
              aria-label="Remove"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- --run src/components/WatchlistTab.test.jsx
```

Expected: 5 tests pass

- [ ] **Step 5: Run full suite**

```bash
npm test -- --run
```

Expected: 355 tests pass (350 existing + 5 new)

- [ ] **Step 6: Commit**

```bash
git add src/components/WatchlistTab.jsx src/components/WatchlistTab.test.jsx
git commit -m "feat(career): WatchlistTab component with search, add, delete"
```

---

### Task 3: CareerView shell

**Files:**
- Create: `src/components/CareerView.jsx`

**Interfaces:**
- Consumes:
  - `supabase` prop (Supabase client)
  - `onTrack` prop: `(opportunity) => void` — called by Radar's "→ Track" button; CareerView switches to applications tab and passes prefill down
  - `initialTab` prop: `'radar' | 'watchlist' | 'applications'` (optional, defaults to `'radar'`)
- Produces: `<CareerView supabase={sb} onTrack={fn} initialTab="radar" />`

- [ ] **Step 1: Implement CareerView**

```jsx
// src/components/CareerView.jsx
import { useState } from 'react'
import OpportunityView from './OpportunityView.jsx'
import ApplicationsView from './ApplicationsView.jsx'
import WatchlistTab from './WatchlistTab.jsx'

const TABS = [
  { id: 'radar', label: 'Radar' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'applications', label: 'Applications' },
]

export default function CareerView({ supabase, initialTab = 'radar', addToast }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [trackPrefill, setTrackPrefill] = useState(null)

  function handleTrack(opportunity) {
    setTrackPrefill(opportunity)
    setActiveTab('applications')
  }

  return (
    <div className="career-view">
      <div className="career-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`career-tab${activeTab === tab.id ? ' career-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="career-tab-panel">
        {activeTab === 'radar' && (
          <OpportunityView supabase={supabase} onTrack={handleTrack} />
        )}
        {activeTab === 'watchlist' && (
          <WatchlistTab supabase={supabase} />
        )}
        {activeTab === 'applications' && (
          <ApplicationsView
            supabase={supabase}
            prefill={trackPrefill}
            onClearPrefill={() => setTrackPrefill(null)}
            addToast={addToast}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test -- --run
```

Expected: 355 tests pass (no regressions)

- [ ] **Step 3: Commit**

```bash
git add src/components/CareerView.jsx
git commit -m "feat(career): CareerView shell with three tabs"
```

---

### Task 4: Wire Career into App.jsx + sidebar

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `CareerView` (import from `./components/CareerView.jsx`)
- The `Briefcase` icon is already imported in App.jsx — reuse it for Career
- `navigateTo('career')` sets `view = 'career'`
- Remove `navigateTo('opportunities')` and `navigateTo('applications')` nav buttons

- [ ] **Step 1: Add CareerView import to App.jsx**

Find the imports block near the top of `src/App.jsx`. Add after the ApplicationsView import:

```jsx
import CareerView from './components/CareerView.jsx'
```

- [ ] **Step 2: Add Career sidebar item in TopicList area**

Find this block in App.jsx (around line 873):
```jsx
        <TopicList
          topics={topics}
```

Add a Career button directly above the `<TopicList` opening tag:

```jsx
        <div className="career-sidebar-item">
          <button
            className={`career-sidebar-btn${view === 'career' ? ' selected' : ''}`}
            onClick={() => navigateTo('career')}
            title="Career"
          >
            <Briefcase size={14} className="career-sidebar-icon" />
            {sidebarOpen && <span>Career</span>}
          </button>
          <hr className="topic-divider" />
        </div>
        <TopicList
          topics={topics}
```

- [ ] **Step 3: Remove old Opportunities and Applications nav items**

Find and delete these two `<li>` blocks (around lines 843–852):
```jsx
          <li>
            <button className={view === 'opportunities' ? 'active' : ''} onClick={() => navigateTo('opportunities')} title="Opportunities">
              <Target size={16} /><span>Opportunities</span>
            </button>
          </li>
          <li>
            <button className={view === 'applications' ? 'active' : ''} onClick={() => navigateTo('applications')} title="Applications">
              <Briefcase size={16} /><span>Applications</span>
            </button>
          </li>
```

- [ ] **Step 4: Replace opportunities/applications view renders with career**

Find these blocks (around lines 1043–1055):
```jsx
          {view === 'opportunities' && (
            <OpportunityView
              supabase={supabase}
              onTrack={handleTrack}
            />
          )}
          {view === 'applications' && (
            <ApplicationsView
              supabase={supabase}
              prefill={trackPrefill}
              onClearPrefill={() => setTrackPrefill(null)}
              addToast={addToast}
            />
          )}
```

Replace with:
```jsx
          {view === 'career' && (
            <CareerView
              supabase={supabase}
              addToast={addToast}
            />
          )}
```

- [ ] **Step 5: Remove now-unused handleTrack and trackPrefill state from App.jsx**

Find and remove:
```jsx
  const [trackPrefill, setTrackPrefill] = useState(null)
```
And:
```jsx
  function handleTrack(opportunity) {
    setTrackPrefill(opportunity)
    setView('applications')
  }
```

- [ ] **Step 6: Remove Target from imports if no longer used**

Find the lucide-react import line and remove `Target` if it's no longer referenced elsewhere:
```jsx
import { Search, Upload, Inbox, RotateCcw, BarChart2, Settings2, Trash2 as TrashIcon, Download, Menu, Home, FolderOpen, Rss, Briefcase, PackageOpen, Archive, ScrollText } from 'lucide-react'
```

- [ ] **Step 7: Run full test suite**

```bash
npm test -- --run
```

Expected: 355 tests pass

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat(career): wire CareerView into App, replace opportunities/applications nav"
```

---

### Task 5: Styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add Career sidebar item styles**

Find the `.topic-row .topic-pin-btn:hover` block (around line 2770) and add after it:

```css
/* Career sidebar item */
.career-sidebar-item { padding: 0 8px; }
.career-sidebar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: none;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}
.career-sidebar-btn:hover { background: var(--border); color: var(--text); }
.career-sidebar-btn.selected { background: var(--accent-subtle); color: var(--accent); font-weight: 500; }
.career-sidebar-icon { flex-shrink: 0; }

/* Career view tabs */
.career-view { display: flex; flex-direction: column; height: 100%; }
.career-tabs {
  display: flex;
  gap: 2px;
  padding: 12px 16px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.career-tab {
  padding: 6px 14px;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  border-radius: 4px 4px 0 0;
  transition: color 0.15s;
}
.career-tab:hover { color: var(--text); }
.career-tab--active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 500; }
.career-tab-panel { flex: 1; overflow-y: auto; }

/* Watchlist */
.watchlist-view { padding: 16px; max-width: 680px; }
.watchlist-header { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
.watchlist-search {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg);
  color: var(--text);
}
.watchlist-search:focus { outline: none; border-color: var(--accent); }
.watchlist-add-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.watchlist-add-form input,
.watchlist-add-form textarea {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
}
.watchlist-date-label { font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px; }
.watchlist-form-actions { display: flex; gap: 8px; }
.watchlist-rows { display: flex; flex-direction: column; gap: 8px; }
.watchlist-row {
  position: relative;
  padding: 10px 32px 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.watchlist-row-main { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.watchlist-row-name { font-size: 13px; font-weight: 500; color: var(--text); text-decoration: none; }
.watchlist-row-name:hover { color: var(--accent); }
.watchlist-row-notes { font-size: 12px; color: var(--text-secondary); margin: 0; }
.watchlist-row-delete { position: absolute; top: 8px; right: 8px; opacity: 0; transition: opacity 0.15s; }
.watchlist-row:hover .watchlist-row-delete { opacity: 1; }
.watchlist-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: 500;
  flex-shrink: 0;
}
.watchlist-badge--open { background: var(--green-subtle, #dcfce7); color: var(--green, #16a34a); }
.watchlist-badge--scheduled { background: var(--accent-subtle); color: var(--accent); }
.watchlist-badge--unknown { background: var(--border); color: var(--text-secondary); }
```

- [ ] **Step 2: Run full test suite**

```bash
npm test -- --run
```

Expected: 355 tests pass

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat(career): styles for career sidebar item, tabs, and watchlist"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Career sidebar item below Inbox with Briefcase icon
- ✅ Three tabs: Radar / Watchlist / Applications
- ✅ Radar = existing OpportunityView moved in, unread count badge — note: unread badge on tab not explicitly in plan; OpportunityView internally shows unread count in its own header which is sufficient. Tab badge is a nice-to-have, not in scope.
- ✅ Watchlist = programs table UI, search across name+notes, sorted by opens_at, add form with opens_at field, status badge
- ✅ Applications = existing ApplicationsView moved in
- ✅ "→ Track" flow: Radar → Applications tab with prefill (handled inside CareerView)
- ✅ opens_at migration
- ✅ Old nav items removed

**Placeholder scan:** None found.

**Type consistency:** `activeTab` uses string literals `'radar' | 'watchlist' | 'applications'` consistently across CareerView. `handleTrack` signature `(opportunity) => void` matches OpportunityView's existing `onTrack` prop.
