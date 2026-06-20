# Responsive Grid + Collapsed Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat entry list with a responsive auto-fill grid of collapsed cards that expand inline on desktop and as a bottom sheet on mobile, add "Move to topic" from expanded cards, and add a doc width control to the topic doc view.

**Architecture:** `EntryCard` gains collapsed/expanded states (inline expand on desktop ≥641px, Modal sheet on mobile ≤640px). `EntryList` passes `moveTargets` and `onMove` straight through. `TopicView` computes `moveTargets`, holds the doc-width preference, and exposes width-preset buttons. CSS handles the responsive grid via a single `auto-fill minmax(200px, 1fr)` rule — no JS breakpoints needed for layout. Import enrichment is a fire-and-forget loop added to App.jsx.

**Tech Stack:** React 18, Vitest + @testing-library/react, CSS Grid, existing `Modal` component

## Global Constraints

- No new npm packages
- Keep existing `Modal` component for the mobile sheet — it already has bottom-sheet CSS at ≤480px; extend to ≤640px
- Mobile breakpoint for sheet vs inline expand: `window.innerWidth <= 640` checked at click time
- All localStorage keys prefixed `medialog_`
- `onMove` removes the entry from the current topic's local state immediately (optimistic)
- Move select resets to placeholder after selection (it is a trigger, not persistent state)
- Doc width stored globally under key `medialog_doc_width`; default `readable`

---

## File Map

| File | Change |
|---|---|
| `src/App.jsx` | Add `handleMove`; add `enrichEntries` helper; call it from `handleBulkImport` + `handleSmartImport`; pass `topics` + `onMove` to `TopicView` |
| `src/components/TopicView.jsx` | Compute `moveTargets`; pass to `EntryList`; add doc-width state + preset buttons |
| `src/components/EntryList.jsx` | Forward `moveTargets` + `onMove` to `EntryCard` |
| `src/components/EntryCard.jsx` | Collapsed/expanded states; mobile sheet via `Modal`; move select in expanded view |
| `src/styles.css` | Responsive grid rule; collapsed card styles; doc-width CSS classes; mobile sheet size fix |
| `src/components/EntryCard.test.jsx` | Update tests to expand card before interacting with hidden controls; add move + checkbox tests |

---

## Task 1: Fix import title enrichment

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `fetchTitle(supabase, url)` from `src/lib/enrich.js` (already imported), `updateEntry(supabase, id, patch)` from `src/lib/db/entries.js` (already imported)
- Produces: `enrichEntries(entries)` — internal async helper, no external consumers

- [ ] **Step 1: Add `enrichEntries` helper and call it from both import handlers**

In `src/App.jsx`, add the helper directly above `handleBulkImport` and call it (fire-and-forget) from both `handleBulkImport` and `handleSmartImport`:

```jsx
  // Fire-and-forget: fetch titles for newly created entries that have a URL but no title yet
  async function enrichEntries(created) {
    for (const e of created) {
      if (e.url && !e.title) {
        const title = await fetchTitle(supabase, e.url)
        if (title) await updateEntry(supabase, e.id, { title })
      }
    }
  }

  async function handleBulkImport(items) {
    const inbox = inboxTopic || (await getTopicByName(supabase, 'Inbox'))
    const created = await bulkCreateEntries(supabase, inbox.id, items)
    enrichEntries(created)   // ← add this line
    return created.length
  }
```

For `handleSmartImport`, accumulate all created entries and enrich at the end. Replace the existing function:

```jsx
  async function handleSmartImport(importedEntries) {
    const byTopic = {}
    for (const e of importedEntries) {
      const t = e.suggested_topic || 'Inbox'
      if (!byTopic[t]) byTopic[t] = []
      byTopic[t].push(e)
    }

    let total = 0
    const newTopics = []
    const allCreated = []

    for (const [topicName, items] of Object.entries(byTopic)) {
      let topic = topics.find((t) => t.name === topicName)
      if (!topic) {
        topic = await createTopic(supabase, topicName)
        newTopics.push(topic)
      }
      const created = await bulkCreateEntries(supabase, topic.id, items)
      allCreated.push(...created)
      total += created.length
    }

    if (newTopics.length > 0) {
      setTopics((prev) => [...prev, ...newTopics].sort((a, b) => a.name.localeCompare(b.name)))
    }

    enrichEntries(allCreated)   // ← add this line
    return total
  }
```

- [ ] **Step 2: Manual smoke test**

Import 2–3 YouTube URLs via Bulk Import. Wait ~5 seconds. Navigate away and back to Inbox. Verify the entries show YouTube video titles instead of raw URLs.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "fix: enrich titles for bulk and smart imported URL entries"
```

---

## Task 2: CSS — responsive grid, collapsed card styles, doc width, mobile sheet

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Produces CSS classes consumed by Tasks 3, 4, 5:
  - `.entry-list-grid` — responsive auto-fill grid
  - `.card.card-collapsed` — collapsed card appearance
  - `.card-preview-note` — 1-line muted note preview in collapsed state
  - `.card-compact-meta` — inline status dot + tags + age row
  - `.status-dot` — 8px colored dot for status in collapsed state
  - `.move-select` — styled like `.status-select`
  - `.master-doc.doc-width-narrow` → `max-width: 640px`
  - `.master-doc.doc-width-readable` → `max-width: 820px`
  - `.master-doc.doc-width-wide` → `max-width: 1100px`
  - `.master-doc.doc-width-full` → `max-width: none`
  - `.doc-width-btns` — small button group for width presets
  - Mobile sheet breakpoint extended from 480px to 640px

- [ ] **Step 1: Update `.entry-list-grid` to responsive auto-fill grid**

Find the existing `.entry-list-grid` rule (currently under a `@media (min-width: 900px)` block) and replace with a top-level rule:

```css
/* ── Entry grid ─────────────────────────────────────────────────────────────── */
.entry-list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  align-items: start;   /* each cell is as tall as its own content */
}
```

Remove the old `.entry-list-grid` rule wherever it appears (check both the base rules and inside any `@media` blocks).

- [ ] **Step 2: Add collapsed card styles**

After the existing `.card:hover` rule, add:

```css
/* Collapsed card */
.card.card-collapsed { cursor: pointer; }
.card.card-collapsed:hover { box-shadow: var(--shadow-card-hover); }

.card-preview-note {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 4px;
}

.card-compact-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 11px;
  color: var(--muted);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.dot-backlog { background: var(--backlog, #888); }
.status-dot.dot-active  { background: var(--active); }
.status-dot.dot-done    { background: var(--done); }
```

- [ ] **Step 3: Add move select style**

After the existing `.status-select` rule, add:

```css
.move-select { padding: 3px 7px; font-size: 12px; border-radius: 6px; }
```

- [ ] **Step 4: Add doc-width classes**

After the `.master-doc` rule, add:

```css
.doc-width-narrow   { max-width: 640px;  margin: 0 auto; }
.doc-width-readable { max-width: 820px;  margin: 0 auto; }
.doc-width-wide     { max-width: 1100px; margin: 0 auto; }
.doc-width-full     { max-width: none; }

.doc-width-btns {
  display: flex;
  gap: 4px;
}
.doc-width-btns button {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  color: var(--muted);
}
.doc-width-btns button.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
```

- [ ] **Step 5: Extend mobile sheet breakpoint to 640px**

Find the existing rule:
```css
@media (max-width: 480px) {
  /* Sheet-style modals on phone */
  .modal-backdrop { padding: 0; align-items: flex-end; }
```

Change it to:
```css
@media (max-width: 640px) {
  /* Sheet-style modals on phone/small tablet */
  .modal-backdrop { padding: 0; align-items: flex-end; }
```

- [ ] **Step 6: Commit**

```bash
git add src/styles.css
git commit -m "style: responsive grid, collapsed card styles, doc width classes, extend sheet breakpoint"
```

---

## Task 3: EntryCard — collapsed/expanded states + mobile sheet

**Files:**
- Modify: `src/components/EntryCard.jsx`
- Modify: `src/components/EntryCard.test.jsx`

**Interfaces:**
- Consumes new props: `moveTargets: Array<{id, name}>`, `onMove: (entryId, topicId) => void` (both optional — card works without them)
- The `Modal` component is already in scope via `../components/Modal.jsx`; import it

- [ ] **Step 1: Add imports and new state**

At the top of `EntryCard.jsx`, add `Modal` import:

```jsx
import Modal from './Modal.jsx'
```

Inside the component, after the existing state declarations, add:

```jsx
  const [expanded, setExpanded] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
```

Also update the prop signature to accept the new props:

```jsx
export default function EntryCard({ entry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onNoteVersion, onShowHistory, onTitleChange, moveTargets, onMove }) {
```

- [ ] **Step 2: Add `handleCardClick`**

After `startEditing`, add:

```jsx
  function handleCardClick(e) {
    if (e.target.closest('a, button, input, select')) return
    if (window.innerWidth <= 640) {
      setShowSheet(true)
    } else {
      setExpanded((prev) => !prev)
    }
  }
```

- [ ] **Step 3: Add move handler**

After `handleCardClick`, add:

```jsx
  function handleMove(e) {
    const topicId = e.target.value
    if (!topicId) return
    e.target.value = ''
    onMove?.(entry.id, topicId)
  }
```

- [ ] **Step 4: Build the collapsed card JSX**

Replace the entire `return (...)` block with the following structure. The collapsed view shows thumbnail + title + note preview + compact meta. The expanded view (or sheet content) shows the full existing card body.

```jsx
  const moveSelect = moveTargets?.length > 0 && (
    <select className="move-select" value="" onChange={handleMove}>
      <option value="" disabled>Move to…</option>
      {moveTargets.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )

  const expandedBody = (
    <>
      {/* Title / URL */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        {editingTitle ? (
          <input
            className="card-title-input"
            aria-label="edit title"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
              if (e.key === 'Escape') { setTitleDraft(entry.title || ''); setEditingTitle(false) }
            }}
            autoFocus
          />
        ) : entry.url ? (
          <a
            href={entry.url}
            className="card-title"
            target="_blank"
            rel="noreferrer"
            onDoubleClick={(e) => { e.preventDefault(); setTitleDraft(entry.title || ''); setEditingTitle(true) }}
          >
            {entry.title || entry.url}
          </a>
        ) : (
          <span
            className="card-title"
            onClick={() => { setTitleDraft(entry.title || ''); setEditingTitle(true) }}
            style={{ cursor: 'text' }}
          >
            {entry.title || <em className="muted">Untitled</em>}
          </span>
        )}
        {!editingTitle && fileType && onPreview && (
          <button className="preview-btn" onClick={() => onPreview(entry.url)}>
            {previewLabel(entry.url)}
          </button>
        )}
      </div>

      {/* YouTube thumbnail */}
      {thumb && !editing && (
        <img
          src={thumb}
          alt=""
          className="card-thumb"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      )}

      {/* Note or editor */}
      {editing ? (
        <Suspense fallback={<p className="muted">Loading editor…</p>}>
          <NoteEditor value={draft} onChange={setDraft} supabase={supabase} />
        </Suspense>
      ) : entry.note ? (
        <div onClick={(e) => { if (e.target.type !== 'checkbox') startEditing() }} style={{ cursor: 'text' }}>
          <MarkdownView onPreview={onPreview} onToggleCheckbox={handleCheckboxToggle}>{entry.note}</MarkdownView>
        </div>
      ) : (
        <span className="card-no-note" onClick={startEditing}>
          Add a thought — why did you save this?
        </span>
      )}

      {/* Meta row */}
      <div className="card-meta">
        <TagInput value={entry.tags || []} onChange={(next) => onTagsChange(entry.id, next)} />
        {age && <span className="card-age">{age}</span>}
        <div className="card-actions">
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
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {saveStatus === 'saving' && <span className="save-status">Saving…</span>}
              {saveStatus === 'saved' && <span className="save-status">Saved ·</span>}
              <button onClick={finishEditing}>Done</button>
            </div>
          ) : (
            <button className="icon-btn" aria-label="edit" onClick={startEditing}>
              <Pencil size={15} />
            </button>
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
          {moveSelect}
          <button
            className="icon-btn icon-btn-danger"
            onClick={() => setConfirmDelete(true)}
            aria-label="delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </>
  )

  const collapsedBody = (
    <>
      {thumb && (
        <img
          src={thumb}
          alt=""
          className="card-thumb"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      )}
      {entry.url ? (
        <a
          href={entry.url}
          className="card-title"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {entry.title || entry.url}
        </a>
      ) : (
        <span className="card-title" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {entry.title || <em className="muted">Untitled</em>}
        </span>
      )}
      {entry.note && (
        <p className="card-preview-note">{entry.note.replace(/[#*`[\]]/g, '').slice(0, 120)}</p>
      )}
      <div className="card-compact-meta">
        {entry.status && (
          <span className={`status-dot dot-${entry.status}`} title={entry.status} />
        )}
        {(entry.tags || []).map((t) => (
          <span key={t} style={{ opacity: 0.7 }}>#{t}</span>
        ))}
        {age && <span style={{ marginLeft: 'auto' }}>{age}</span>}
      </div>
    </>
  )

  return (
    <>
      <div
        className={`card${entry.pinned ? ' pinned' : ''}${expanded ? '' : ' card-collapsed'}`}
        id={`entry-${entry.id}`}
        onClick={expanded ? undefined : handleCardClick}
      >
        {expanded ? expandedBody : collapsedBody}

        {confirmDelete && (
          <ConfirmModal
            message="Move this entry to trash?"
            confirmLabel="Move to Trash"
            onConfirm={() => { setConfirmDelete(false); onDelete(entry.id) }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </div>

      {showSheet && (
        <Modal onClose={() => setShowSheet(false)} label={entry.title || 'Entry'}>
          <div style={{ padding: '4px 0' }}>
            {expandedBody}
            {confirmDelete && (
              <ConfirmModal
                message="Move this entry to trash?"
                confirmLabel="Move to Trash"
                onConfirm={() => { setConfirmDelete(false); onDelete(entry.id); setShowSheet(false) }}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </div>
        </Modal>
      )}
    </>
  )
```

- [ ] **Step 5: Update tests in `EntryCard.test.jsx`**

Tests that interact with controls only visible when expanded must first expand the card. Add a helper and update the affected tests:

```jsx
// Add after the `handlers` const:
async function expandCard(container) {
  // Click the card body (not a link/button) to expand inline
  const card = container.querySelector('.card-collapsed')
  if (card) await userEvent.click(card)
}
```

Update each test that interacts with `pin`, `edit`, `status`, `delete`:

```jsx
test('toggles pin', async () => {
  const onTogglePin = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onTogglePin={onTogglePin} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /pin/i }))
  expect(onTogglePin).toHaveBeenCalledWith('x', true)
})

test('edits the note and saves on Done', async () => {
  const onNoteSave = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.clear(editor)
  await userEvent.type(editor, 'updated note')
  await userEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(onNoteSave).toHaveBeenCalledWith('x', 'updated note')
})

test('changes status', async () => {
  const onStatusChange = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onStatusChange={onStatusChange} />)
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox', { name: '' }), 'done')
  expect(onStatusChange).toHaveBeenCalledWith('x', 'done')
})

test('delete asks for confirmation, then fires onDelete', async () => {
  const onDelete = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onDelete={onDelete} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /move to trash/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})

test('shows saving indicator while autosave timer is pending', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const onNoteSave = vi.fn()
  const { container } = render(<EntryCard entry={base} {...handlers} onNoteSave={onNoteSave} />)
  await expandCard(container)
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  const editor = await screen.findByLabelText('note editor')
  await userEvent.type(editor, 'x')
  expect(screen.getByText(/saving/i)).toBeInTheDocument()
  vi.useRealTimers()
})
```

Add new tests:

```jsx
test('collapsed by default — edit button not visible until expanded', () => {
  render(<EntryCard entry={base} {...handlers} />)
  expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
})

test('clicking collapsed card expands it', async () => {
  const { container } = render(<EntryCard entry={base} {...handlers} />)
  await expandCard(container)
  expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
})

test('move select calls onMove and disappears entry', async () => {
  const onMove = vi.fn()
  const targets = [{ id: 't2', name: 'Books' }]
  const { container } = render(
    <EntryCard entry={base} {...handlers} moveTargets={targets} onMove={onMove} />
  )
  await expandCard(container)
  await userEvent.selectOptions(screen.getByRole('combobox', { name: '' }), 't2')
  expect(onMove).toHaveBeenCalledWith('x', 't2')
})
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/components/EntryCard.test.jsx
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/EntryCard.jsx src/components/EntryCard.test.jsx
git commit -m "feat: collapsed cards with inline expand (desktop) and sheet (mobile), move-to select"
```

---

## Task 4: Wire move through App → TopicView → EntryList

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/TopicView.jsx`
- Modify: `src/components/EntryList.jsx`

**Interfaces:**
- Consumes: `updateEntry(supabase, id, { topic_id })` — already imported in App.jsx
- Produces: `onMove` prop on `EntryList` and `EntryCard`; `moveTargets` prop on `EntryList` and `EntryCard`

- [ ] **Step 1: Add `handleMove` to App.jsx**

Inside `Workspace`, after `handleTitleChange`, add:

```jsx
  async function handleMove(entryId, newTopicId) {
    await updateEntry(supabase, entryId, { topic_id: newTopicId })
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }
```

Then in the `<TopicView>` JSX, add two new props:

```jsx
  <TopicView
    key={selectedTopic.id}
    topic={selectedTopic}
    topics={topics}          // ← add
    entries={entries}
    allCandidates={candidateIndex}
    onAddEntry={handleAddEntry}
    onDelete={handleDelete}
    onStatusChange={handleStatusChange}
    onTagsChange={handleTagsChange}
    onTogglePin={handleTogglePin}
    onNoteSave={handleNoteSave}
    onPreview={openPreview}
    onDocChange={(doc) => handleDocChange(selectedTopic.id, doc)}
    onNoteVersion={handleNoteVersion}
    onShowHistory={handleShowHistory}
    onSearchAll={handleSearchAll}
    globalSearchResults={globalSearchResults}
    onTitleChange={handleTitleChange}
    onMove={handleMove}      // ← add
  />
```

- [ ] **Step 2: Update TopicView to compute `moveTargets` and forward to EntryList**

In `TopicView.jsx`, update the prop signature to accept `topics` and `onMove`:

```jsx
export default function TopicView({
  topic, entries, allCandidates, topics,
  onAddEntry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onDocChange,
  onNoteVersion, onShowHistory,
  onSearchAll, globalSearchResults,
  onTitleChange, onMove,
}) {
```

Compute `moveTargets` right inside the component body (after the hooks):

```jsx
  const moveTargets = (topics || []).filter((t) => t.id !== topic.id)
```

Pass to `<EntryList>`:

```jsx
  <EntryList
    entries={filtered}
    onDelete={onDelete}
    onStatusChange={onStatusChange}
    onTagsChange={onTagsChange}
    onTogglePin={onTogglePin}
    onNoteSave={onNoteSave}
    onPreview={onPreview}
    onNoteVersion={onNoteVersion}
    onShowHistory={onShowHistory}
    onTitleChange={onTitleChange}
    moveTargets={moveTargets}   // ← add
    onMove={onMove}             // ← add
  />
```

- [ ] **Step 3: Update EntryList to forward props to EntryCard**

In `EntryList.jsx`, update the prop signature:

```jsx
export default function EntryList({ entries, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onNoteVersion, onShowHistory, onTitleChange, moveTargets, onMove }) {
```

And pass to each `<EntryCard>`:

```jsx
  <EntryCard
    key={e.id}
    entry={e}
    onDelete={onDelete}
    onStatusChange={onStatusChange}
    onTagsChange={onTagsChange}
    onTogglePin={onTogglePin}
    onNoteSave={onNoteSave}
    onPreview={onPreview}
    onNoteVersion={onNoteVersion}
    onShowHistory={onShowHistory}
    onTitleChange={onTitleChange}
    moveTargets={moveTargets}   // ← add
    onMove={onMove}             // ← add
  />
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/EntryList.test.jsx src/components/EntryCard.test.jsx
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/TopicView.jsx src/components/EntryList.jsx
git commit -m "feat: wire onMove through App → TopicView → EntryList → EntryCard"
```

---

## Task 5: Doc width control in TopicView

**Files:**
- Modify: `src/components/TopicView.jsx`

**Interfaces:**
- Consumes: CSS classes `.doc-width-narrow`, `.doc-width-readable`, `.doc-width-wide`, `.doc-width-full` from Task 2
- Produces: Width preset buttons in the topic header; persisted to `localStorage` key `medialog_doc_width`

- [ ] **Step 1: Add doc-width state to TopicView**

In `TopicView.jsx`, add a state initializer after the existing `useState` calls:

```jsx
  const [docWidth, setDocWidth] = useState(() => {
    try { return localStorage.getItem('medialog_doc_width') || 'readable' } catch { return 'readable' }
  })

  function setDocWidthAndSave(w) {
    setDocWidth(w)
    try { localStorage.setItem('medialog_doc_width', w) } catch {}
  }
```

- [ ] **Step 2: Add width preset buttons to the topic header**

In the JSX, update the `<div className="topic-header">` block to show the width buttons when in doc mode:

```jsx
  <div className="topic-header">
    <h2>{topic.name}</h2>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {mode === 'doc' && (
        <div className="doc-width-btns">
          {[
            { key: 'narrow',   label: 'S' },
            { key: 'readable', label: 'M' },
            { key: 'wide',     label: 'L' },
            { key: 'full',     label: '∞' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={docWidth === key ? 'active' : ''}
              onClick={() => setDocWidthAndSave(key)}
              title={key}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="view-toggle">
        <button className={mode === 'doc' ? 'active' : ''} onClick={() => setView('doc')}>Doc</button>
        <button className={mode === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 3: Apply the width class to `.master-doc`**

Find the `<div className="master-doc">` element in TopicView and add the width class:

```jsx
  <div className={`master-doc doc-width-${docWidth}`}>
```

- [ ] **Step 4: Manual test**

Open a topic in Doc mode. Verify S/M/L/∞ buttons appear in the header. Click each and confirm the doc content area changes width. Reload the page — the chosen width should persist.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopicView.jsx
git commit -m "feat: doc width presets (S/M/L/∞) in topic doc view, persisted to localStorage"
```

---

## Self-Review

**Spec coverage:**
- ✅ Fix import title enrichment — Task 1
- ✅ Responsive grid — Task 2 CSS + existing `.entry-list-grid`
- ✅ Collapsed cards by default with thumbnail — Tasks 2 + 3
- ✅ Inline expand on desktop — Task 3
- ✅ Bottom sheet on mobile (≤640px) — Tasks 2 + 3
- ✅ Move to topic select — Tasks 3 + 4
- ✅ Doc width control — Tasks 2 + 5
- ✅ Tests updated — Task 3

**Placeholder scan:** None found.

**Type consistency:**
- `moveTargets: Array<{id, name}>` used consistently across Tasks 3 and 4
- `onMove(entryId, topicId)` signature consistent in App.jsx, TopicView, EntryList, EntryCard
- CSS class names `doc-width-${key}` consistent between Task 2 and Task 5
- `handleCheckboxToggle` referenced in Task 3 expandedBody — this already exists in EntryCard from the checkbox feature implemented earlier in the session ✅
