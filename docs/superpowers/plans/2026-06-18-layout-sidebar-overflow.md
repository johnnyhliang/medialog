# Layout, Collapsible Sidebar & Card Overflow Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-width main content, collapsible sidebar (44px icon rail on desktop, hamburger overlay on mobile), and fix card actions overflowing narrow grid cells.

**Architecture:** `sidebarOpen` boolean state lives in `Workspace` (App.jsx), persisted to `localStorage`. CSS handles the two sidebar widths via `.app.sidebar-collapsed`. Mobile (≤680px) switches to a fixed overlay drawer triggered by a hamburger button in a topbar. Card overflow is fixed with CSS flex-wrap and a `⋯` overflow menu for secondary actions below a container-query width threshold.

**Tech Stack:** React 18, Lucide icons (already installed), CSS container queries (supported in all modern browsers)

## Global Constraints

- No new npm packages
- `localStorage` key for sidebar state: `medialog_sidebar_open` (default: `true` = open)
- Collapsed sidebar width: 44px
- Expanded sidebar width: 224px (256px at ≥1200px)
- Mobile breakpoint for hamburger: ≤680px (matches existing breakpoint)
- Icons from `lucide-react` already in the project
- Nav items must show tooltip (`title` attribute) when sidebar is collapsed

---

## File Map

| File | Change |
|---|---|
| `src/App.jsx` | Add `sidebarOpen` state; toggle handler; hamburger button in mobile topbar; collapsed icon rendering in sidebar nav + topic list |
| `src/styles.css` | Remove `max-width` from `.main`; sidebar collapsed styles; icon rail; mobile overlay; card actions overflow fix; container query on `.card` |

---

## Task 1: Full-width main + sidebar collapse state + CSS

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `.app.sidebar-collapsed` CSS class (consumed by Task 2)
- Produces: `sidebarOpen` state + `toggleSidebar` function in `Workspace`

- [ ] **Step 1: Remove max-width from .main in styles.css**

Find and update the `.main` rule:
```css
.main {
  flex: 1;
  padding: 24px 28px;
  min-width: 0;
}
```
Remove `max-width: 1000px` from `.main` and `max-width: 1100px` from the `@media (min-width: 1200px)` block's `.main` rule.

- [ ] **Step 2: Add sidebar collapse CSS**

After the existing `.sidebar` rule block, add:
```css
/* Collapsed sidebar (icon rail) */
.app.sidebar-collapsed .sidebar {
  width: 44px;
  padding: 16px 0;
  gap: 12px;
  overflow: hidden;
}
.app.sidebar-collapsed .sidebar h1,
.app.sidebar-collapsed .brand-row .signout,
.app.sidebar-collapsed .nav button span,
.app.sidebar-collapsed .topic-list-label,
.app.sidebar-collapsed .topic-add,
.app.sidebar-collapsed .topic-name-text {
  display: none;
}
.app.sidebar-collapsed .nav button {
  width: 44px;
  justify-content: center;
  padding: 8px 0;
  border-radius: 0;
}
.app.sidebar-collapsed .topic-item button {
  width: 44px;
  justify-content: center;
  padding: 6px 0;
  font-size: 11px;
  font-weight: 600;
}
.sidebar-toggle {
  margin-top: auto;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px 0;
  font-size: 18px;
}
.sidebar-toggle:hover { color: var(--text); }
```

- [ ] **Step 3: Add sidebar state to App.jsx Workspace**

At the top of the `Workspace` function, after existing state declarations, add:
```jsx
const [sidebarOpen, setSidebarOpen] = useState(() => {
  try { return localStorage.getItem('medialog_sidebar_open') !== 'false' } catch { return true }
})

function toggleSidebar() {
  setSidebarOpen((prev) => {
    const next = !prev
    try { localStorage.setItem('medialog_sidebar_open', String(next)) } catch {}
    return next
  })
}
```

Apply the class to `.app`:
```jsx
<div className={`app${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
```

- [ ] **Step 4: Add sidebar toggle button to sidebar JSX**

At the bottom of the `<aside className="sidebar">` element, before its closing tag, add:
```jsx
<button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
  {sidebarOpen ? '‹' : '›'}
</button>
```

- [ ] **Step 5: Add icons to nav buttons for collapsed state**

Import icons at the top of App.jsx:
```jsx
import { LayoutGrid, Upload, Inbox, RotateCcw, BarChart2, Settings2, Trash2 as TrashIcon, Download, ChevronLeft, ChevronRight } from 'lucide-react'
```

Update each nav `<li>` button to include an icon + wrapped text span. Example pattern:
```jsx
<li>
  <button
    className={view === 'browse' ? 'active' : ''}
    onClick={() => setView('browse')}
    title="Browse"
  >
    <LayoutGrid size={16} />
    <span>Browse</span>
  </button>
</li>
```

Apply this pattern to all 7 nav items (Browse, Bulk Import, Sort Inbox, Revisit, Progress, Settings, Trash) and the Export button. Each button gets the appropriate icon from the imports above.

Nav icon mapping:
- Browse → `LayoutGrid`
- Bulk Import → `Upload`
- Sort Inbox → `Inbox`
- Revisit → `RotateCcw`
- Progress → `BarChart2`
- Settings → `Settings2`
- Trash → `TrashIcon`
- Export → `Download`

Update `.nav button` CSS to `display: flex; align-items: center; gap: 8px;`:
```css
.nav button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 12px; ... }
```
(Preserve existing padding/border/color rules, just add flex layout.)

- [ ] **Step 6: Topic initials in collapsed sidebar**

In the `TopicList` component (`src/components/TopicList.jsx`), topic buttons need to show initials when collapsed. Since TopicList doesn't know about sidebar state, pass `sidebarCollapsed` prop from App.jsx:

In App.jsx, pass `sidebarCollapsed={!sidebarOpen}` to `<TopicList>`.

In `TopicList.jsx`, accept and use it:
```jsx
export default function TopicList({ topics, selectedId, onSelect, onAdd, sidebarCollapsed }) {
```

For each topic button, show initials when collapsed:
```jsx
<button
  className={...}
  onClick={() => onSelect(t.id)}
  title={t.name}
>
  {sidebarCollapsed
    ? t.name.slice(0, 2).toUpperCase()
    : t.name
  }
</button>
```

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/styles.css src/components/TopicList.jsx
git commit -m "feat: collapsible sidebar icon rail, full-width main layout"
```

---

## Task 2: Mobile hamburger overlay

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `sidebarOpen`, `toggleSidebar` from Task 1

- [ ] **Step 1: Add mobile topbar CSS**

In the existing `@media (max-width: 680px)` block, replace the current mobile sidebar rules with:

```css
@media (max-width: 680px) {
  .app { flex-direction: column; }

  .mobile-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--sidebar-bg);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .mobile-topbar h1 {
    font-family: var(--font-serif);
    font-size: 18px;
    font-weight: 600;
    color: var(--accent);
    margin: 0;
  }
  .hamburger-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text);
    display: flex;
    padding: 4px;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 260px !important;
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    box-shadow: 4px 0 16px rgba(0,0,0,0.12);
  }
  .sidebar.mobile-open {
    transform: translateX(0);
  }
  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    z-index: 199;
  }
  .sidebar-overlay.visible { display: block; }

  .main { padding: 16px; }
}

@media (min-width: 681px) {
  .mobile-topbar { display: none; }
  .sidebar-overlay { display: none !important; }
}
```

- [ ] **Step 2: Add mobile topbar and overlay JSX to App.jsx**

In the `Workspace` return, before `<aside className="sidebar">`, add the mobile topbar. Also add the overlay div and `mobile-open` class to sidebar:

```jsx
return (
  <div className={`app${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
    {/* Mobile topbar */}
    <header className="mobile-topbar">
      <h1>MediaLog</h1>
      <button className="hamburger-btn" onClick={toggleSidebar} aria-label="Toggle menu">
        <Menu size={22} />
      </button>
    </header>

    {/* Sidebar overlay (mobile) */}
    <div
      className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
      onClick={toggleSidebar}
    />

    <aside className={`sidebar${sidebarOpen ? ' mobile-open' : ''}`}>
      {/* existing sidebar content */}
    </aside>
    ...
```

Add `Menu` to lucide-react imports.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx src/styles.css
git commit -m "feat: mobile hamburger overlay sidebar"
```

---

## Task 3: Card actions overflow fix

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/EntryCard.jsx`

**Interfaces:**
- None — self-contained fix

- [ ] **Step 1: Add container query to .card**

Add at the top of the card rules section in styles.css:
```css
.card { container-type: inline-size; container-name: card; }
```

Add a container query that hides secondary actions on narrow cards and shows an overflow button:
```css
@container card (max-width: 280px) {
  .card-secondary-actions { display: none; }
  .card-overflow-btn { display: flex !important; }
}
@container card (min-width: 281px) {
  .card-overflow-btn { display: none !important; }
}
.card-overflow-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 0 4px;
  font-size: 16px;
  line-height: 1;
}
.card-overflow-btn:hover { color: var(--text); }
```

- [ ] **Step 2: Wrap secondary actions in EntryCard.jsx**

In the `expandedBody` actions section, wrap the secondary action buttons (pin, history, move-select) in a `<div className="card-secondary-actions">` and add an overflow button that toggles their visibility on narrow cards:

```jsx
{/* Secondary actions — hidden on narrow cards */}
<div className="card-secondary-actions" style={{ display: 'contents' }}>
  <button
    className="icon-btn"
    aria-label={entry.pinned ? 'unpin' : 'pin'}
    onClick={() => onTogglePin(entry.id, !entry.pinned)}
  >
    {entry.pinned ? <PinOff size={15} /> : <Pin size={15} />}
  </button>
  {onShowHistory && (
    <button className="icon-btn" aria-label="history" onClick={() => onShowHistory(entry.id)}>
      <Clock size={15} />
    </button>
  )}
  {moveSelect}
</div>
```

The existing primary actions (edit/done, status-select, delete) stay outside this wrapper and always show.

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/components/EntryCard.test.jsx
```

Expected: all 16 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css src/components/EntryCard.jsx
git commit -m "fix: card actions overflow on narrow grid cells via container query"
```
