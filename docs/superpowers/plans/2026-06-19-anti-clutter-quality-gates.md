# Anti-Clutter Quality Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four lightweight anti-clutter features that reduce junk entries and surface hidden rot without blocking the user.

**Architecture:** Two self-contained UI improvements — one to QuickAdd (catch duplicates at capture, nudge for notes) and one to EntryCard (surface aged note-free entries, prompt for a takeaway before marking Done). All Supabase calls stay in App.jsx; components receive props.

**Tech Stack:** React 18, Vitest + @testing-library/react, Supabase JS client (already wired), Tailwind-free (custom CSS in `src/styles.css`).

## Global Constraints

- App.jsx is the **only file that calls Supabase** — components receive data and callbacks as props.
- No new npm packages.
- All 188 existing tests must continue to pass (`npm test` = `vitest run`).
- CSS changes go in `src/styles.css` (single file, no co-location).
- `src/styles.css` uses CSS custom properties: `--muted`, `--surface`, `--border`, `--text`, `--accent`, `--text-xs`.

---

### Task 1: QuickAdd — URL duplicate detection + soft note nudge

**Files:**
- Modify: `src/components/QuickAdd.jsx`
- Modify: `src/components/TopicView.jsx` (line ~268 — pass new prop to QuickAdd)
- Modify: `src/App.jsx` (add `handleCheckDuplicate`, pass to TopicView)
- Modify: `src/styles.css` (two new rule blocks)
- Modify: `src/components/QuickAdd.test.jsx`

**Interfaces:**
- Consumes: `onCheckDuplicate(url: string) => Promise<{ id: string, created_at: string, topic_name: string } | null>` — optional prop (no-op if absent)
- Produces: nothing consumed by Task 2

- [ ] **Step 1: Write the failing tests**

Add to `src/components/QuickAdd.test.jsx`:

```jsx
test('shows duplicate warning after URL field blurs when duplicate found', async () => {
  const onCheckDuplicate = vi.fn(() =>
    Promise.resolve({ id: 'y', created_at: '2026-06-01T00:00:00Z', topic_name: 'AI' })
  )
  render(<QuickAdd onAdd={vi.fn()} disabled={false} onCheckDuplicate={onCheckDuplicate} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.tab()
  expect(await screen.findByText(/you saved this/i)).toBeInTheDocument()
  expect(screen.getByText('AI')).toBeInTheDocument()
})

test('does not show duplicate warning when no duplicate found', async () => {
  const onCheckDuplicate = vi.fn(() => Promise.resolve(null))
  render(<QuickAdd onAdd={vi.fn()} disabled={false} onCheckDuplicate={onCheckDuplicate} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.tab()
  await new Promise(r => setTimeout(r, 50))
  expect(screen.queryByText(/you saved this/i)).not.toBeInTheDocument()
})

test('duplicate warning dismisses on clicking Dismiss', async () => {
  const onCheckDuplicate = vi.fn(() =>
    Promise.resolve({ id: 'y', created_at: '2026-06-01T00:00:00Z', topic_name: 'AI' })
  )
  render(<QuickAdd onAdd={vi.fn()} disabled={false} onCheckDuplicate={onCheckDuplicate} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.tab()
  await screen.findByText(/you saved this/i)
  await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
  expect(screen.queryByText(/you saved this/i)).not.toBeInTheDocument()
})

test('shows soft nudge after saving with URL but no note', async () => {
  const onAdd = vi.fn(() => Promise.resolve())
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(screen.getByText(/no notes yet/i)).toBeInTheDocument()
})

test('nudge clears when user types in note field', async () => {
  const onAdd = vi.fn(() => Promise.resolve())
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(screen.getByText(/no notes yet/i)).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText(/worth remembering/i), 'a')
  expect(screen.queryByText(/no notes yet/i)).not.toBeInTheDocument()
})

test('does not show nudge when note is present on save', async () => {
  const onAdd = vi.fn(() => Promise.resolve())
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.type(screen.getByPlaceholderText(/worth remembering/i), 'my note')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(screen.queryByText(/no notes yet/i)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --reporter=verbose src/components/QuickAdd.test.jsx
```

Expected: 6 new tests fail, 2 original tests still pass.

- [ ] **Step 3: Update QuickAdd.jsx**

Replace entire `src/components/QuickAdd.jsx` with:

```jsx
import { useState } from 'react'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function QuickAdd({ onAdd, disabled, onCheckDuplicate }) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [dupWarning, setDupWarning] = useState(null)
  const [showNudge, setShowNudge] = useState(false)

  async function handleUrlBlur() {
    const u = url.trim()
    if (!u || !onCheckDuplicate) { setDupWarning(null); return }
    const dup = await onCheckDuplicate(u)
    setDupWarning(dup || null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const u = url.trim()
    const n = note.trim()
    if (!u && !n) return
    if (u && !n) setShowNudge(true)
    else setShowNudge(false)
    setDupWarning(null)
    await onAdd({ url: u || null, note: n })
    setUrl('')
    setNote('')
  }

  return (
    <form className="quickadd" onSubmit={handleSubmit}>
      <input
        placeholder="Paste a link (optional)"
        maxLength={2000}
        value={url}
        onChange={(e) => { setUrl(e.target.value); setDupWarning(null) }}
        onBlur={handleUrlBlur}
      />
      {dupWarning && (
        <p className="quickadd-dup-warning">
          You saved this on {formatDate(dupWarning.created_at)} in <strong>{dupWarning.topic_name}</strong>.{' '}
          <button type="button" className="link-btn" onClick={() => setDupWarning(null)}>Dismiss</button>
        </p>
      )}
      <textarea
        placeholder="What's worth remembering about this?"
        maxLength={10000}
        rows={2}
        value={note}
        onChange={(e) => { setNote(e.target.value); if (e.target.value) setShowNudge(false) }}
      />
      {showNudge && (
        <p className="quickadd-nudge">No notes yet — why does this matter?</p>
      )}
      <div className="quickadd-row">
        <button type="submit" disabled={disabled}>Save</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Add `handleCheckDuplicate` to App.jsx**

In `src/App.jsx`, add this function after `handleSearchAll` (~line 173):

```js
async function handleCheckDuplicate(url) {
  if (!url) return null
  const { data } = await supabase
    .from('entries')
    .select('id, created_at, topics(name)')
    .eq('url', url)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) return null
  return { id: data.id, created_at: data.created_at, topic_name: data.topics?.name || 'Unknown' }
}
```

Then in the JSX where TopicView is rendered (~line 492), add the prop:

```jsx
{view === 'browse' && selectedTopic && (
  <TopicView
    ...existing props...
    onCheckDuplicate={handleCheckDuplicate}
  />
)}
```

- [ ] **Step 5: Pass the prop through TopicView**

In `src/components/TopicView.jsx`, add `onCheckDuplicate` to the props destructure:

```jsx
export default function TopicView({
  topic, entries, allCandidates, topics,
  onAddEntry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onDocChange,
  onNoteVersion, onShowHistory,
  onSearchAll, globalSearchResults,
  onTitleChange, onMove, tagColors,
  allTags = [],
  pendingArchiveIds = new Set(),
  supabase,
  onCheckDuplicate,
}) {
```

And at the QuickAdd render line (~line 268):

```jsx
{!query && <QuickAdd onAdd={onAddEntry} disabled={false} onCheckDuplicate={onCheckDuplicate} />}
```

- [ ] **Step 6: Add CSS rules to styles.css**

Append to the end of the `.quickadd` section (after line with `.quickadd textarea`):

```css
.quickadd-dup-warning {
  font-size: var(--text-xs);
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.quickadd-dup-warning .link-btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--muted);
  cursor: pointer;
  font-size: inherit;
  text-decoration: underline;
  margin-left: auto;
}
.quickadd-nudge {
  font-size: var(--text-xs);
  color: var(--muted);
  margin: 0;
  padding: 0 2px;
  font-style: italic;
}
```

- [ ] **Step 7: Run all tests**

```
npm test
```

Expected: all 188 + 6 new = 194 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/QuickAdd.jsx src/components/QuickAdd.test.jsx src/components/TopicView.jsx src/App.jsx src/styles.css
git commit -m "feat: duplicate URL detection and soft note nudge in QuickAdd"
```

---

### Task 2: EntryCard — aged no-note chip + done takeaway prompt

**Files:**
- Modify: `src/components/EntryCard.jsx`
- Modify: `src/styles.css`
- Modify: `src/components/EntryCard.test.jsx`

**Interfaces:**
- Consumes: nothing new from Task 1
- Produces: nothing consumed downstream

- [ ] **Step 1: Write the failing tests**

Read the current `src/components/EntryCard.test.jsx` to see what's there, then add the following tests at the end of the file:

```jsx
test('shows no-note chip for entries with no note older than 14 days', () => {
  const oldDate = new Date(Date.now() - 15 * 86400000).toISOString()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false, created_at: oldDate }
  const { container } = render(<EntryCard entry={entry} {...handlers} />)
  expect(screen.getByText(/no notes/i)).toBeInTheDocument()
  expect(container.querySelector('.card-aged-no-note')).not.toBeNull()
})

test('does not show no-note chip when note exists even if old', () => {
  const oldDate = new Date(Date.now() - 15 * 86400000).toISOString()
  const entry = { ...base, created_at: oldDate }
  const { container } = render(<EntryCard entry={entry} {...handlers} />)
  expect(screen.queryByText(/no notes/i)).not.toBeInTheDocument()
  expect(container.querySelector('.card-aged-no-note')).toBeNull()
})

test('does not show no-note chip for entries newer than 14 days with no note', () => {
  const recentDate = new Date(Date.now() - 10 * 86400000).toISOString()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false, created_at: recentDate }
  const { container } = render(<EntryCard entry={entry} {...handlers} />)
  expect(screen.queryByText(/no notes/i)).not.toBeInTheDocument()
  expect(container.querySelector('.card-aged-no-note')).toBeNull()
})

test('shows takeaway prompt when transitioning to done with no note', async () => {
  const onStatusChange = vi.fn()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false }
  const { container } = render(<EntryCard entry={entry} {...handlers} onStatusChange={onStatusChange} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(screen.getByText(/any final takeaway/i)).toBeInTheDocument()
  expect(onStatusChange).not.toHaveBeenCalled()
})

test('skip on takeaway prompt calls onStatusChange with done', async () => {
  const onStatusChange = vi.fn()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false }
  const { container } = render(<EntryCard entry={entry} {...handlers} onStatusChange={onStatusChange} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  await userEvent.click(screen.getByRole('button', { name: /skip/i }))
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
  expect(screen.queryByText(/any final takeaway/i)).not.toBeInTheDocument()
})

test('save on takeaway prompt calls onNoteSave then onStatusChange with done', async () => {
  const onStatusChange = vi.fn()
  const onNoteSave = vi.fn()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: null, status: null, tags: [], pinned: false }
  const { container } = render(<EntryCard entry={entry} {...handlers} onStatusChange={onStatusChange} onNoteSave={onNoteSave} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  await userEvent.type(screen.getByPlaceholderText(/what did you learn/i), 'my takeaway')
  await userEvent.click(screen.getByRole('button', { name: /save & done/i }))
  expect(onNoteSave).toHaveBeenCalledWith('x', 'my takeaway')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})

test('skips takeaway prompt when transitioning to done with existing note', async () => {
  const onStatusChange = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onStatusChange={onStatusChange} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'done')
  expect(screen.queryByText(/any final takeaway/i)).not.toBeInTheDocument()
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --reporter=verbose src/components/EntryCard.test.jsx
```

Expected: 7 new tests fail, existing tests pass.

- [ ] **Step 3: Add aged-card logic and takeaway prompt to EntryCard.jsx**

In `src/components/EntryCard.jsx`, make the following changes:

**3a.** After the existing `relativeAge` function, add:

```js
function daysOld(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}
```

**3b.** In the component body, after `const age = relativeAge(entry.created_at)`, add:

```js
const days = daysOld(entry.created_at)
const noNoteAged = !entry.note && days >= 14
```

**3c.** Add takeaway prompt state. After the existing `const [showSecondaryActions, setShowSecondaryActions] = useState(false)` line, add:

```js
const [takeawayPrompt, setTakeawayPrompt] = useState(false)
const [takeaway, setTakeaway] = useState('')
```

**3d.** Add the status change interceptor. Add this function after `handleMove`:

```js
function handleStatusSelect(e) {
  const status = e.target.value || null
  if (status === 'done' && !entry.note) {
    setTakeawayPrompt(true)
  } else {
    onStatusChange(entry.id, status)
  }
}

function handleTakeawaySave() {
  if (takeaway.trim()) onNoteSave(entry.id, takeaway.trim())
  onStatusChange(entry.id, 'done')
  setTakeawayPrompt(false)
  setTakeaway('')
}

function handleTakeawaySkip() {
  onStatusChange(entry.id, 'done')
  setTakeawayPrompt(false)
}
```

**3e.** In the `collapsedBody`, after the `{entry.note && ...card-preview-note...}` block and before the `card-compact-meta` div, add:

```jsx
{noNoteAged && (
  <span className="card-no-note-chip">no notes · {days}d</span>
)}
```

**3f.** In `expandedBody`, in the actions bar section, insert the takeaway prompt block just before the `<div className="card-actions-bar">` opening tag:

```jsx
{takeawayPrompt && (
  <div className="takeaway-prompt" onClick={(e) => e.stopPropagation()}>
    <p className="takeaway-prompt-label">Any final takeaway to add?</p>
    <textarea
      className="takeaway-input"
      placeholder="What did you learn?"
      rows={2}
      value={takeaway}
      onChange={(e) => setTakeaway(e.target.value)}
      autoFocus
    />
    <div className="takeaway-actions">
      <button className="btn-small" onClick={handleTakeawaySave}>Save &amp; Done</button>
      <button className="btn-small btn-ghost" onClick={handleTakeawaySkip}>Skip</button>
    </div>
  </div>
)}
```

**3g.** In the status select inside `expandedBody`, change `onChange`:

From:
```jsx
onChange={(e) => onStatusChange(entry.id, e.target.value || null)}
```

To:
```jsx
onChange={handleStatusSelect}
```

**3h.** In the outer `<div className="card ...">`, add the aged class. Find:

```jsx
className={`card ${entry.status ? `card-status-${entry.status}` : 'card-status-backlog'}${entry.pinned ? ' pinned' : ''}${expanded ? '' : ' card-collapsed'}`}
```

Change to:

```jsx
className={`card ${entry.status ? `card-status-${entry.status}` : 'card-status-backlog'}${entry.pinned ? ' pinned' : ''}${expanded ? '' : ' card-collapsed'}${noNoteAged ? ' card-aged-no-note' : ''}`}
```

- [ ] **Step 4: Add CSS rules to styles.css**

After the `.card-age { ... }` rule (around line 597), add:

```css
.card-no-note-chip {
  font-size: 10px;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  display: inline-block;
  margin-top: 4px;
}
.card-aged-no-note {
  opacity: 0.65;
}
.takeaway-prompt {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.takeaway-prompt-label {
  margin: 0;
  font-size: 13px;
  color: var(--text);
}
.takeaway-input {
  width: 100%;
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg, #fff);
  color: var(--text);
  resize: vertical;
  box-sizing: border-box;
}
.takeaway-actions {
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 5: Run all tests**

```
npm test
```

Expected: all tests pass (188 existing + 7 new = 195 total).

- [ ] **Step 6: Commit**

```bash
git add src/components/EntryCard.jsx src/components/EntryCard.test.jsx src/styles.css
git commit -m "feat: aged no-note card chip and done takeaway prompt"
```
