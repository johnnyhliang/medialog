# Opportunity Radar — Frontend Implementation Plan (Agent B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dashboard widgets and full-page view for the Opportunity Radar: deadline alert banner, opportunities feed widget with manual submission, and application tracker with status pipeline.

**Architecture:** Three new components (DeadlineAlertBanner, OpportunitiesWidget, ApplicationsView) plus modifications to WidgetPanel and App. All Supabase reads happen inside the components via the `supabase` prop. No new npm packages.

**Tech Stack:** React 18, Vite 5, `@supabase/supabase-js` v2, Vitest + @testing-library/react, custom CSS in `src/styles.css`

## Global Constraints

- No Supabase calls in any file except via the `supabase` prop passed down from App — never import supabaseClient directly in these components
- No new npm packages
- All CSS goes in `src/styles.css` (single file, existing custom properties: `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--text`, `--muted`, `--accent`, `--accent-weak`, `--done`, `--active`, `--danger`, `--radius`, `--gap`, `--text-xs`, `--text-sm`, `--text-base`)
- All existing tests must pass after every task (`npm test`)
- DB schema (already applied by Agent A):
  - `opportunities(id, source, company, title, body, url, author, posted_at, fetched_at, tags, is_read, is_saved)`
  - `programs(id, name, url, category, company, deadline, window_open, notes, last_checked)`
  - `applications(id, opportunity_id, company, role, url, status, applied_at, deadline, notes, created_at, updated_at)`

---

## Task 1: CSS — opportunity radar styles

**Files:**
- Modify: `src/styles.css`

Add all new CSS classes needed by Tasks 2–5 in one go so later tasks can reference them without editing the stylesheet again.

- [ ] **Step 1: Append to `src/styles.css`**

```css
/* ── Deadline Alert Banner ───────────────────────────────────────────────────── */
.deadline-banner {
  background: #FEF3C7;
  border: 1px solid #F59E0B;
  border-radius: var(--radius);
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.deadline-banner-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-sm);
}
.deadline-bell { font-size: 13px; }
.deadline-name { color: #92400E; flex: 1; font-weight: 500; }
.deadline-name:hover { text-decoration: underline; }
.deadline-dismiss {
  background: none;
  border: none;
  color: #92400E;
  cursor: pointer;
  padding: 0 4px;
  font-size: 16px;
  line-height: 1;
  opacity: 0.6;
}
.deadline-dismiss:hover { opacity: 1; }

/* ── Opportunities Widget ────────────────────────────────────────────────────── */
.opp-widget { display: flex; flex-direction: column; }
.opp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.opp-badge {
  display: inline-block;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 10px;
  padding: 1px 6px;
  margin-left: 6px;
  vertical-align: middle;
}
.opp-add-btn {
  font-size: var(--text-xs);
  padding: 3px 8px;
  background: transparent;
  border-color: var(--border);
  color: var(--muted);
}
.opp-add-btn:hover { background: var(--surface-2); color: var(--text); }

.opp-manual-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
}
.opp-manual-form input,
.opp-manual-form select { font-size: var(--text-sm); }
.opp-manual-form button[type="submit"] {
  align-self: flex-end;
  font-size: var(--text-sm);
  padding: 4px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
}

.opp-filter-pills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.opp-pill {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 20px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
}
.opp-pill:hover { background: var(--surface-3); color: var(--text); }
.opp-pill.active { background: var(--accent-weak); color: var(--accent); border-color: var(--accent); font-weight: 600; }

.opp-rows { display: flex; flex-direction: column; }
.opp-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--text-sm);
  opacity: 1;
  transition: opacity 0.1s;
}
.opp-row:last-child { border-bottom: none; }
.opp-row.read { opacity: 0.55; }
.opp-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
.opp-title {
  flex: 1;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--text-sm);
}
.opp-title:hover { color: var(--accent); }
.opp-age { color: var(--muted); font-size: 11px; white-space: nowrap; }
.opp-save-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0 2px;
  font-size: 13px;
}
.opp-save-btn.saved { color: #F59E0B; }
.opp-track-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0 2px;
  font-size: 13px;
}
.opp-track-btn:hover { color: var(--accent); }
.opp-load-more {
  font-size: var(--text-xs);
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 0 0;
  text-align: left;
}
.opp-load-more:hover { color: var(--text); }

/* Source chips */
.opp-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  text-transform: lowercase;
  white-space: nowrap;
  flex-shrink: 0;
}
.opp-chip-sky     { background: #E0F2FE; color: #0369A1; }
.opp-chip-green   { background: #DCFCE7; color: #15803D; }
.opp-chip-orange  { background: #FEF3C7; color: #B45309; }
.opp-chip-purple  { background: #F3E8FF; color: #7E22CE; }
.opp-chip-slate   { background: var(--surface-2); color: var(--muted); }
.opp-chip-amber   { background: #FEF3C7; color: #92400E; }

/* ── Applications View ───────────────────────────────────────────────────────── */
.apps-view {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  padding: 24px 28px;
}
.apps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.apps-title { font-size: var(--text-xl); font-weight: 700; margin: 0; }
.apps-add-btn {
  font-size: var(--text-sm);
  padding: 5px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 7px;
}
.apps-add-btn:hover { background: #2d4338; }

.apps-form {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.apps-form-row { display: flex; gap: 8px; }
.apps-form-row > * { flex: 1; }
.apps-form textarea { min-height: 60px; }
.apps-form button[type="submit"] {
  align-self: flex-end;
  padding: 6px 16px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-weight: 600;
}

.apps-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}
.apps-tab {
  font-size: var(--text-sm);
  padding: 5px 12px;
  border-radius: 7px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--muted);
}
.apps-tab:hover { background: var(--surface-2); color: var(--text); }
.apps-tab.active { background: var(--accent-weak); color: var(--accent); border-color: var(--accent); font-weight: 600; }

.apps-list { display: flex; flex-direction: column; gap: 8px; }
.apps-empty { color: var(--muted); font-size: var(--text-sm); padding: 20px 0; }

.apps-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--shadow-card);
}
.apps-card-top { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.apps-card-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; }
.apps-company { font-weight: 700; font-size: var(--text-base); }
.apps-role { color: var(--muted); font-size: var(--text-sm); }
.apps-link { color: var(--muted); font-size: 13px; }
.apps-link:hover { color: var(--accent); }
.apps-card-meta { display: flex; gap: 6px; align-items: center; color: var(--muted); font-size: var(--text-xs); }
.apps-deadline { color: var(--danger); }
.apps-card-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.apps-status-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 20px;
  cursor: pointer;
  border: 1px solid transparent;
}
.apps-status-saved     { background: var(--surface-2); color: var(--muted); border-color: var(--border); }
.apps-status-applied   { background: #DBEAFE; color: #1D4ED8; }
.apps-status-screen    { background: #FEF3C7; color: #B45309; }
.apps-status-interview { background: #EDE9FE; color: #7C3AED; }
.apps-status-offer     { background: #DCFCE7; color: #15803D; }
.apps-status-rejected  { background: #FEE2E2; color: #B91C1C; }
.apps-status-ghosted   { background: var(--surface-2); color: var(--muted); }
.apps-notes-toggle, .apps-delete {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: var(--text-xs);
  padding: 2px 4px;
}
.apps-delete:hover { color: var(--danger); }
.apps-notes { width: 100%; min-height: 60px; font-size: var(--text-sm); }
.apps-confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-sm);
  color: var(--danger);
  padding-top: 4px;
}
.apps-confirm button { font-size: var(--text-xs); padding: 3px 8px; }
```

- [ ] **Step 2: Verify no existing tests break**

```bash
npm test
```
Expected: all suites pass (CSS changes don't affect test output).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: opportunity radar and application tracker CSS"
```

---

## Task 2: `DeadlineAlertBanner.jsx`

**Files:**
- Create: `src/components/widgets/DeadlineAlertBanner.jsx`
- Create: `src/components/widgets/DeadlineAlertBanner.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop (Supabase client). Queries `programs` table where `window_open = true`.
- Produces: nothing consumed by other components

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/widgets/DeadlineAlertBanner.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import DeadlineAlertBanner from './DeadlineAlertBanner.jsx'

function mockSupabase(programs) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: programs, error: null }),
      }),
    }),
  }
}

beforeEach(() => localStorage.clear())

test('renders nothing when no open programs', async () => {
  const { container } = render(<DeadlineAlertBanner supabase={mockSupabase([])} />)
  await waitFor(() => {})
  expect(container.firstChild).toBeNull()
})

test('renders open program with deadline', async () => {
  const programs = [{ id: '1', name: 'Neo Scholars', url: 'https://neo.com', deadline: '2026-09-15', category: 'program', company: 'Neo', notes: null, window_open: true }]
  render(<DeadlineAlertBanner supabase={mockSupabase(programs)} />)
  expect(await screen.findByText(/Neo Scholars/)).toBeInTheDocument()
  expect(screen.getByText(/Sep 15/)).toBeInTheDocument()
})

test('dismiss hides the row', async () => {
  const programs = [{ id: '2', name: '8VC Fellowship', url: 'https://8vc.com', deadline: null, category: 'fellowship', company: '8VC', notes: null, window_open: true }]
  render(<DeadlineAlertBanner supabase={mockSupabase(programs)} />)
  await screen.findByText(/8VC Fellowship/)
  await userEvent.click(screen.getByRole('button', { name: '×' }))
  expect(screen.queryByText(/8VC Fellowship/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/widgets/DeadlineAlertBanner.test.jsx
```
Expected: FAIL — `DeadlineAlertBanner` not found.

- [ ] **Step 3: Implement `src/components/widgets/DeadlineAlertBanner.jsx`**

```jsx
import { useEffect, useState } from 'react'

export default function DeadlineAlertBanner({ supabase }) {
  const [programs, setPrograms] = useState([])
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_programs') ?? '[]') }
    catch { return [] }
  })

  useEffect(() => {
    supabase.from('programs').select('*').eq('window_open', true)
      .then(({ data }) => { if (data) setPrograms(data) })
  }, [supabase])

  function dismiss(id) {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem('dismissed_programs', JSON.stringify(next))
  }

  const visible = programs
    .filter((p) => !dismissed.includes(p.id))
    .sort((a, b) => {
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })

  if (!visible.length) return null

  return (
    <div className="deadline-banner">
      {visible.map((p) => (
        <div key={p.id} className="deadline-banner-row">
          <span className="deadline-bell">🔔</span>
          <a href={p.url} target="_blank" rel="noreferrer" className="deadline-name">
            {p.name}
            {p.deadline
              ? ` — deadline ${new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : ' — applications open'}
          </a>
          <button className="deadline-dismiss" onClick={() => dismiss(p.id)}>×</button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/widgets/DeadlineAlertBanner.test.jsx
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/widgets/DeadlineAlertBanner.jsx src/components/widgets/DeadlineAlertBanner.test.jsx
git commit -m "feat: deadline alert banner for open fellowship programs"
```

---

## Task 3: `OpportunitiesWidget.jsx`

**Files:**
- Create: `src/components/widgets/OpportunitiesWidget.jsx`
- Create: `src/components/widgets/OpportunitiesWidget.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop, `onTrack(opportunity)` callback prop (called when user clicks → on a row)
- Produces: nothing consumed by other components directly

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/widgets/OpportunitiesWidget.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import OpportunitiesWidget from './OpportunitiesWidget.jsx'

function makeItem(overrides = {}) {
  return {
    id: 'a',
    source: 'hn',
    company: 'Stripe',
    title: 'SWE Intern',
    body: null,
    url: 'https://hn.com/1',
    author: null,
    posted_at: new Date(Date.now() - 3600000).toISOString(),
    tags: ['hn'],
    is_read: false,
    is_saved: false,
    ...overrides,
  }
}

function mockSupabase(items = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: makeItem({ id: 'new', source: 'manual', title: 'example.com' }), error: null }) })
  }))
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: items, error: null })),
        })),
      })),
      update: updateFn,
      insert: insertFn,
    })),
    _updateFn: updateFn,
    _insertFn: insertFn,
  }
}

test('shows unread badge count', async () => {
  const items = [makeItem({ id: '1' }), makeItem({ id: '2' })]
  render(<OpportunitiesWidget supabase={mockSupabase(items)} onTrack={vi.fn()} />)
  expect(await screen.findByText(/2 new/)).toBeInTheDocument()
})

test('clicking title marks as read', async () => {
  const sb = mockSupabase([makeItem()])
  render(<OpportunitiesWidget supabase={sb} onTrack={vi.fn()} />)
  await screen.findByText(/Stripe — SWE Intern/)
  await userEvent.click(screen.getByRole('link', { name: /Stripe — SWE Intern/ }))
  expect(sb._updateFn).toHaveBeenCalled()
})

test('manual add form submits url', async () => {
  const sb = mockSupabase([])
  render(<OpportunitiesWidget supabase={sb} onTrack={vi.fn()} />)
  await waitFor(() => {})
  await userEvent.click(screen.getByText('+ add'))
  await userEvent.type(screen.getByPlaceholderText('URL'), 'https://example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(sb._insertFn).toHaveBeenCalled()
})

test('filter pill filters by quant tag', async () => {
  const items = [
    makeItem({ id: '1', company: 'Stripe', tags: ['startup'] }),
    makeItem({ id: '2', company: 'Jane Street', tags: ['quant'] }),
  ]
  render(<OpportunitiesWidget supabase={mockSupabase(items)} onTrack={vi.fn()} />)
  await screen.findByText(/Stripe/)
  await userEvent.click(screen.getByRole('button', { name: 'Quant' }))
  expect(screen.queryByText(/Stripe/)).not.toBeInTheDocument()
  expect(screen.getByText(/Jane Street/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/widgets/OpportunitiesWidget.test.jsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `src/components/widgets/OpportunitiesWidget.jsx`**

```jsx
import { useEffect, useState, useCallback } from 'react'

const SOURCE_COLORS = {
  twitter: 'sky',
  greenhouse: 'green',
  lever: 'green',
  ashby: 'green',
  hn: 'orange',
  github: 'purple',
  manual: 'slate',
  'program-alert': 'amber',
}

const FILTERS = ['All', 'SWE', 'Quant', 'Fellowship', 'Twitter', 'Saved']

function formatAge(date) {
  const diff = Date.now() - date.getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m`
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function OppRow({ item, onRead, onSave, onTrack }) {
  const chipColor = SOURCE_COLORS[item.source] ?? 'slate'
  const age = item.posted_at ? formatAge(new Date(item.posted_at)) : ''
  const label = item.company ? `${item.company} — ${item.title}` : item.title

  return (
    <div className={`opp-row ${item.is_read ? 'read' : ''}`}>
      {!item.is_read && <span className="opp-dot" />}
      <span className={`opp-chip opp-chip-${chipColor}`}>{item.source}</span>
      <a
        className="opp-title"
        href={item.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => onRead(item.id)}
      >
        {label}
      </a>
      <span className="opp-age">{age}</span>
      <button
        className={`opp-save-btn ${item.is_saved ? 'saved' : ''}`}
        onClick={() => onSave(item.id, item.is_saved)}
        title="Save"
      >★</button>
      {onTrack && (
        <button className="opp-track-btn" onClick={() => onTrack(item)} title="Track">→</button>
      )}
    </div>
  )
}

export default function OpportunitiesWidget({ supabase, onTrack }) {
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addTag, setAddTag] = useState('swe')
  const [showMore, setShowMore] = useState(false)
  const [lastChecked, setLastChecked] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('opportunities')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(100)
    if (data) setItems(data)
    setLastChecked(new Date())
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function markRead(id) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_read: true } : i))
    await supabase.from('opportunities').update({ is_read: true }).eq('id', id)
  }

  async function toggleSaved(id, current) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_saved: !current } : i))
    await supabase.from('opportunities').update({ is_saved: !current }).eq('id', id)
  }

  async function handleManualAdd(e) {
    e.preventDefault()
    if (!addUrl.trim()) return
    const hostname = (() => { try { return new URL(addUrl).hostname } catch { return addUrl } })()
    const { data } = await supabase
      .from('opportunities')
      .insert({
        source: 'manual',
        title: hostname,
        body: addNote || null,
        url: addUrl.trim(),
        tags: [addTag],
        posted_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (data) setItems((prev) => [data, ...prev])
    setAddUrl(''); setAddNote(''); setShowAdd(false)
  }

  const filtered = items.filter((i) => {
    if (filter === 'Saved') return i.is_saved
    if (filter === 'Twitter') return i.source === 'twitter'
    if (filter === 'SWE') return i.tags?.some((t) => ['swe', 'startup', 'big-tech'].includes(t))
    if (filter === 'Quant') return i.tags?.includes('quant')
    if (filter === 'Fellowship') return i.tags?.some((t) => ['fellowship', 'program', 'program-alert'].includes(t))
    return true
  })

  const unread = filtered.filter((i) => !i.is_read)
  const read = filtered.filter((i) => i.is_read && !i.is_saved)
  const visible = showMore ? filtered : unread.slice(0, 20)
  const minutesAgo = lastChecked ? Math.floor((Date.now() - lastChecked.getTime()) / 60000) : null

  return (
    <div className="opp-widget">
      <div className="opp-header">
        <span className="kw-label">
          opportunities
          {unread.length > 0 && <span className="opp-badge">{unread.length} new</span>}
        </span>
        <button className="opp-add-btn" onClick={() => setShowAdd((v) => !v)}>+ add</button>
      </div>

      {showAdd && (
        <form className="opp-manual-form" onSubmit={handleManualAdd}>
          <input
            placeholder="URL"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            required
          />
          <input
            placeholder="Note (optional)"
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
          />
          <select value={addTag} onChange={(e) => setAddTag(e.target.value)}>
            <option value="swe">SWE</option>
            <option value="quant">Quant</option>
            <option value="fellowship">Fellowship</option>
            <option value="research">Research</option>
            <option value="product">Product</option>
          </select>
          <button type="submit">Save</button>
        </form>
      )}

      <div className="opp-filter-pills">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`opp-pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="kw-empty">loading…</p>}
      {!loading && visible.length === 0 && (
        <p className="kw-empty">
          No new opportunities{minutesAgo !== null ? ` · checked ${minutesAgo}m ago` : ''}
        </p>
      )}

      <div className="opp-rows">
        {visible.map((item) => (
          <OppRow
            key={item.id}
            item={item}
            onRead={markRead}
            onSave={toggleSaved}
            onTrack={onTrack}
          />
        ))}
      </div>

      {!showMore && read.length > 0 && (
        <button className="opp-load-more" onClick={() => setShowMore(true)}>
          load more ({read.length})
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/widgets/OpportunitiesWidget.test.jsx
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/widgets/OpportunitiesWidget.jsx src/components/widgets/OpportunitiesWidget.test.jsx
git commit -m "feat: opportunities widget with filters, manual add, read/save tracking"
```

---

## Task 4: `ApplicationsView.jsx`

**Files:**
- Create: `src/components/ApplicationsView.jsx`
- Create: `src/components/ApplicationsView.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop, `prefill` prop (`{ id, company, title, url } | null` — pre-fills the add form when user clicks Track from widget), `onClearPrefill()` callback
- Produces: nothing consumed by other components

- [ ] **Step 1: Write the failing tests**

```jsx
// src/components/ApplicationsView.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import ApplicationsView from './ApplicationsView.jsx'

const STATUS_CYCLE = { saved: 'applied', applied: 'screen', screen: 'interview', interview: 'offer' }

function mockApp(overrides = {}) {
  return {
    id: 'a1',
    company: 'Anthropic',
    role: 'Research Engineer',
    url: 'https://anthropic.com',
    status: 'applied',
    applied_at: '2026-06-01',
    deadline: null,
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    opportunity_id: null,
    ...overrides,
  }
}

function mockSupabase(apps = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const deleteFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: mockApp(), error: null }) })
  }))
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: apps, error: null })) })),
      update: updateFn,
      delete: deleteFn,
      insert: insertFn,
    })),
    _updateFn: updateFn,
    _deleteFn: deleteFn,
    _insertFn: insertFn,
  }
}

test('shows application in correct status tab', async () => {
  render(<ApplicationsView supabase={mockSupabase([mockApp()])} prefill={null} onClearPrefill={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Applied/ }))
  expect(screen.getByText('Anthropic')).toBeInTheDocument()
  expect(screen.getByText('Research Engineer')).toBeInTheDocument()
})

test('clicking status badge cycles to next status', async () => {
  const sb = mockSupabase([mockApp()])
  render(<ApplicationsView supabase={sb} prefill={null} onClearPrefill={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Applied/ }))
  const badge = screen.getByRole('button', { name: 'Applied' })
  await userEvent.click(badge)
  expect(sb._updateFn).toHaveBeenCalled()
})

test('prefill opens add form with company + role', async () => {
  const prefill = { id: 'opp1', company: 'Stripe', title: 'SWE Intern', url: 'https://stripe.com' }
  render(<ApplicationsView supabase={mockSupabase([])} prefill={prefill} onClearPrefill={vi.fn()} />)
  await waitFor(() => {
    expect(screen.getByDisplayValue('Stripe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('SWE Intern')).toBeInTheDocument()
  })
})

test('delete requires confirmation', async () => {
  const sb = mockSupabase([mockApp()])
  render(<ApplicationsView supabase={sb} prefill={null} onClearPrefill={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: /Applied/ }))
  await userEvent.click(screen.getByRole('button', { name: '×' }))
  expect(screen.getByText(/Delete this application/)).toBeInTheDocument()
  expect(sb._deleteFn).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
  expect(sb._deleteFn).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/ApplicationsView.test.jsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `src/components/ApplicationsView.jsx`**

```jsx
import { useEffect, useState, useCallback } from 'react'

const STATUSES = ['saved', 'applied', 'screen', 'interview', 'offer', 'rejected', 'ghosted']
const STATUS_NEXT = {
  saved: 'applied', applied: 'screen', screen: 'interview',
  interview: 'offer', offer: 'offer', rejected: 'rejected', ghosted: 'ghosted',
}
const STATUS_LABELS = {
  saved: 'Saved', applied: 'Applied', screen: 'Screen',
  interview: 'Interview', offer: 'Offer', rejected: 'Rejected', ghosted: 'Ghosted',
}

export default function ApplicationsView({ supabase, prefill, onClearPrefill }) {
  const [apps, setApps] = useState([])
  const [statusFilter, setStatusFilter] = useState('applied')
  const [showAdd, setShowAdd] = useState(!!prefill)
  const [form, setForm] = useState({
    company: prefill?.company ?? '',
    role: prefill?.title ?? '',
    url: prefill?.url ?? '',
    status: 'applied',
    applied_at: '',
    deadline: '',
    notes: '',
    opportunity_id: prefill?.id ?? null,
  })
  const [expandedNotes, setExpandedNotes] = useState(new Set())
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('applications')
      .select('*')
      .order('updated_at', { ascending: false })
    if (data) setApps(data)
  }, [supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (prefill) {
      setForm((f) => ({
        ...f,
        company: prefill.company ?? '',
        role: prefill.title ?? '',
        url: prefill.url ?? '',
        opportunity_id: prefill.id,
      }))
      setShowAdd(true)
    }
  }, [prefill])

  async function handleAdd(e) {
    e.preventDefault()
    const { data } = await supabase
      .from('applications')
      .insert({ ...form, applied_at: form.applied_at || null, deadline: form.deadline || null })
      .select()
      .single()
    if (data) { setApps((prev) => [data, ...prev]); setShowAdd(false); onClearPrefill?.() }
  }

  async function cycleStatus(id, current) {
    const next = STATUS_NEXT[current]
    if (next === current) return
    const now = new Date().toISOString()
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, status: next, updated_at: now } : a))
    await supabase.from('applications').update({ status: next, updated_at: now }).eq('id', id)
  }

  async function updateNotes(id, notes) {
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, notes } : a))
    await supabase.from('applications').update({ notes, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function deleteApp(id) {
    setApps((prev) => prev.filter((a) => a.id !== id))
    await supabase.from('applications').delete().eq('id', id)
    setConfirmDelete(null)
  }

  function toggleNotes(id) {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: apps.filter((a) => a.status === s).length }), {})
  const visible = apps.filter((a) => a.status === statusFilter)

  return (
    <div className="apps-view">
      <div className="apps-header">
        <h2 className="apps-title">Applications</h2>
        <button className="apps-add-btn" onClick={() => setShowAdd((v) => !v)}>+ add</button>
      </div>

      {showAdd && (
        <form className="apps-form" onSubmit={handleAdd}>
          <div className="apps-form-row">
            <input placeholder="Company" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} required />
            <input placeholder="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} required />
          </div>
          <div className="apps-form-row">
            <input placeholder="URL (optional)" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="apps-form-row">
            <input type="date" placeholder="Applied date" value={form.applied_at} onChange={(e) => setForm((f) => ({ ...f, applied_at: e.target.value }))} />
            <input type="date" placeholder="Deadline" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <button type="submit">Save</button>
        </form>
      )}

      <div className="apps-tabs">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`apps-tab ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABELS[s]}{counts[s] > 0 ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      <div className="apps-list">
        {visible.length === 0 && <p className="apps-empty">Nothing here yet.</p>}
        {visible.map((app) => (
          <div key={app.id} className="apps-card">
            <div className="apps-card-top">
              <div className="apps-card-info">
                <span className="apps-company">{app.company}</span>
                <span className="apps-role">{app.role}</span>
                {app.url && <a href={app.url} target="_blank" rel="noreferrer" className="apps-link">↗</a>}
              </div>
              <div className="apps-card-meta">
                {app.applied_at && (
                  <span className="apps-date">
                    Applied {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {app.deadline && (
                  <span className="apps-deadline">
                    · Deadline {new Date(app.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <div className="apps-card-actions">
                <button
                  className={`apps-status-badge apps-status-${app.status}`}
                  onClick={() => cycleStatus(app.id, app.status)}
                >
                  {STATUS_LABELS[app.status]}
                </button>
                <button className="apps-notes-toggle" onClick={() => toggleNotes(app.id)}>notes ▾</button>
                <button className="apps-delete" onClick={() => setConfirmDelete(app.id)}>×</button>
              </div>
            </div>
            {expandedNotes.has(app.id) && (
              <textarea
                className="apps-notes"
                value={app.notes ?? ''}
                placeholder="Add notes…"
                onChange={(e) => updateNotes(app.id, e.target.value)}
              />
            )}
            {confirmDelete === app.id && (
              <div className="apps-confirm">
                <span>Delete this application?</span>
                <button onClick={() => deleteApp(app.id)}>Yes, delete</button>
                <button onClick={() => setConfirmDelete(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/ApplicationsView.test.jsx
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ApplicationsView.jsx src/components/ApplicationsView.test.jsx
git commit -m "feat: application tracker with status pipeline, prefill from opportunities"
```

---

## Task 5: Wire into WidgetPanel + App

**Files:**
- Modify: `src/components/WidgetPanel.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Read current `src/components/WidgetPanel.jsx`**

(Read the file before editing — required by tooling.)

- [ ] **Step 2: Update `WidgetPanel.jsx` to add DeadlineAlertBanner and OpportunitiesWidget**

Add imports at the top:
```jsx
import DeadlineAlertBanner from './DeadlineAlertBanner.jsx'
import OpportunitiesWidget from './OpportunitiesWidget.jsx'
```

Add both components at the top of the returned JSX, before existing widgets, passing `supabase` and `onTrack`:
```jsx
export default function WidgetPanel({ supabase, onTrack }) {
  return (
    <div className="widget-panel">
      <DeadlineAlertBanner supabase={supabase} />
      <OpportunitiesWidget supabase={supabase} onTrack={onTrack} />
      {/* existing widgets below */}
      ...
    </div>
  )
}
```

- [ ] **Step 3: Read current `src/App.jsx`**

(Read the file before editing — required by tooling.)

- [ ] **Step 4: Update `src/App.jsx`**

Add to imports:
```jsx
import ApplicationsView from './components/ApplicationsView.jsx'
import { Briefcase } from 'lucide-react'
```

Add `'applications'` to view state and a `trackPrefill` state:
```jsx
const [view, setView] = useState('home')  // existing
const [trackPrefill, setTrackPrefill] = useState(null)
```

Add the Applications nav item in the sidebar nav (after Home, before Browse):
```jsx
<li>
  <button
    className={view === 'applications' ? 'active' : ''}
    onClick={() => setView('applications')}
  >
    <Briefcase size={15} />
    <span>Applications</span>
  </button>
</li>
```

Add `onTrack` handler:
```jsx
function handleTrack(opportunity) {
  setTrackPrefill(opportunity)
  setView('applications')
}
```

Pass `onTrack` to `HomeView` (which passes it to `WidgetPanel`):
```jsx
<HomeView
  ...existing props...
  onTrack={handleTrack}
/>
```

Add `onTrack` to `HomeView` prop signature, pass to `WidgetPanel`:
```jsx
// In HomeView.jsx — add onTrack to props and pass to WidgetPanel
export default function HomeView({ topics, inboxCount, onSelectTopic, onSortInbox, onTopicIconChange, supabase, onTrack }) {
  ...
  <WidgetPanel supabase={supabase} onTrack={onTrack} />
```

Add ApplicationsView to the render switch (alongside existing view conditionals):
```jsx
{view === 'applications' && (
  <ApplicationsView
    supabase={supabase}
    prefill={trackPrefill}
    onClearPrefill={() => setTrackPrefill(null)}
  />
)}
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/WidgetPanel.jsx src/App.jsx src/components/HomeView.jsx
git commit -m "feat: wire opportunities widget and application tracker into dashboard"
```

---

## Frontend Done Criteria

- `npm test` passes all suites
- Dashboard shows `DeadlineAlertBanner` above widgets when any program has `window_open = true`
- `OpportunitiesWidget` renders in WidgetPanel above MarketNewsWidget, shows empty state when DB is empty, populates when backend runs
- Manual `+ add` form saves to `opportunities` table and appears immediately in the list
- Filter pills correctly filter by SWE, Quant, Fellowship, Twitter, Saved
- Clicking → on an opportunity row navigates to Applications view with form pre-filled
- Applications view shows status tabs with counts, clicking status badge cycles it forward, notes expand inline, delete requires confirmation
- Sidebar shows "Applications" nav item with Briefcase icon
