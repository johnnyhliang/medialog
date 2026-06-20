# Archive Done Entries with Undo Toast

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an entry is marked "done", it stays visible briefly with a 3-second toast (progress bar + Undo button). After the timer or on navigation, it moves to a collapsed archive section at the bottom of the topic. Toast can be disabled in Settings (entries archive immediately).

**Architecture:** `useToast` and `Toast` are extended to support action buttons and a progress bar. A `pendingArchiveIds` Set in App.jsx tracks entries mid-transition. TopicView receives the set and filters done entries from the main list (except those pending). An `ArchiveSection` component at the bottom of TopicView loads done entries on demand. The toast-on-done setting is stored in `user_configs.archive_toast` (boolean, default true).

**Tech Stack:** React 18, Supabase (user_configs column), existing Toast system

## Global Constraints

- No new npm packages
- Toast duration: exactly 3000ms
- Progress bar animates from 100% → 0% over 3 seconds using CSS animation
- `user_configs.archive_toast` column: boolean, default true (toast enabled)
- Done entries are NOT deleted — they stay in the DB with `status = 'done'`
- Archive section is collapsed by default; "Show archived (N)" button loads them
- Undo reverts status to `'backlog'` (the previous status before done)
- On navigation away (topic change): pending entries are committed immediately (no toast)

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/0010_archive_toast_setting.sql` | Add `archive_toast boolean default true` to user_configs |
| `src/hooks/useToast.js` | Support `actions` array and `duration` in toast data |
| `src/components/Toast.jsx` | Render action buttons; progress bar countdown |
| `src/styles.css` | Progress bar animation; toast action button styles |
| `src/App.jsx` | `pendingArchiveIds` state; modified `handleStatusChange`; `handleUndoArchive`; pass to TopicView; Settings archive_toast config |
| `src/components/TopicView.jsx` | Filter pending done from main list; pass to EntryList; add ArchiveSection |
| `src/components/ArchiveSection.jsx` | New component: collapsible, loads done entries on demand |
| `src/components/SettingsView.jsx` | Archive toast toggle |

---

## Task 1: DB migration + settings load

**Files:**
- Create: `supabase/migrations/0010_archive_toast_setting.sql`
- Modify: `src/App.jsx`
- Modify: `src/components/SettingsView.jsx`

**Interfaces:**
- Produces: `archiveToast` boolean in Workspace state (default `true`)
- Produces: `user_configs.archive_toast` DB column

- [ ] **Step 1: Create migration**

```sql
alter table user_configs add column if not exists archive_toast boolean not null default true;
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Load archive_toast in App.jsx**

In Workspace, add state:
```jsx
const [archiveToast, setArchiveToast] = useState(true)
```

In `loadConfig` in SettingsView (or equivalent place where user_configs is fetched), the `archive_toast` field will automatically be included since SettingsView uses `select('*')`. Pass it through.

In App.jsx Workspace, add a `handleToggleArchiveToast` and pass to SettingsView:
```jsx
async function handleToggleArchiveToast(val) {
  setArchiveToast(val)
  await supabase.from('user_configs').update({ archive_toast: val }).eq('user_id', (await supabase.auth.getUser()).data.user.id)
}
```

Also initialize `archiveToast` from user_configs when topics load. Add to `refreshTopics` or a separate `useEffect`:
```jsx
useEffect(() => {
  supabase.from('user_configs').select('archive_toast').maybeSingle().then(({ data }) => {
    if (data && typeof data.archive_toast === 'boolean') setArchiveToast(data.archive_toast)
  })
}, [])
```

Pass to SettingsView:
```jsx
<SettingsView
  ...
  archiveToast={archiveToast}
  onToggleArchiveToast={handleToggleArchiveToast}
/>
```

- [ ] **Step 4: Add toggle to SettingsView**

In SettingsView, accept `archiveToast` and `onToggleArchiveToast` props. Add a toggle in a "Behavior" or "Notifications" section:

```jsx
<section>
  <h3 className="section-label">Behavior</h3>
  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
    <input
      type="checkbox"
      checked={archiveToast ?? true}
      onChange={(e) => onToggleArchiveToast(e.target.checked)}
    />
    Show undo notification when archiving done entries (3 seconds)
  </label>
</section>
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0010_archive_toast_setting.sql src/App.jsx src/components/SettingsView.jsx
git commit -m "feat(db): archive_toast setting in user_configs; toggle in Settings"
```

---

## Task 2: Extend Toast for action buttons + progress bar

**Files:**
- Modify: `src/hooks/useToast.js`
- Modify: `src/components/Toast.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- `addToast(message, type, options)` — `options.actions: Array<{label, onClick}>`, `options.duration: number` (ms, default 4000)
- `Toast` renders a progress bar div when `toast.duration` is set, and action buttons when `toast.actions` is set

- [ ] **Step 1: Update useToast.js**

```js
import { useCallback, useState } from 'react'

export default function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = crypto.randomUUID()
    const duration = options.duration ?? 4000
    const toast = { id, message, type, duration, actions: options.actions || [] }
    setToasts((prev) => [...prev, toast])
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      options.onExpire?.()
    }, duration)
    // Store timer so dismissToast can cancel it
    toast._timer = timer
    return id
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => {
      const t = prev.find(t => t.id === id)
      if (t?._timer) clearTimeout(t._timer)
      return prev.filter((t) => t.id !== id)
    })
  }, [])

  return { toasts, addToast, dismissToast }
}
```

Note: `_timer` on toast state is a side-channel; alternatively store timers in a ref map. Use a `useRef` map for timer IDs to avoid storing non-serializable values in state:

```js
import { useCallback, useRef, useState } from 'react'

export default function useToast() {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const addToast = useCallback((message, type = 'info', options = {}) => {
    const id = crypto.randomUUID()
    const duration = options.duration ?? 4000
    setToasts((prev) => [...prev, { id, message, type, duration, actions: options.actions || [] }])
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      delete timers.current[id]
      options.onExpire?.()
    }, duration)
    return id
  }, [])

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}
```

- [ ] **Step 2: Update Toast.jsx to render progress bar and action buttons**

```jsx
import { X } from 'lucide-react'

export default function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-msg">{t.message}</span>
          {t.actions.map((a, i) => (
            <button
              key={i}
              className="toast-action-btn"
              onClick={() => { a.onClick(); onDismiss(t.id) }}
            >
              {a.label}
            </button>
          ))}
          <button className="icon-btn" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <X size={13} />
          </button>
          {t.duration && (
            <div
              className="toast-progress"
              style={{ animationDuration: `${t.duration}ms` }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Add progress bar CSS**

Add to styles.css after existing toast styles:
```css
.toast { position: relative; overflow: hidden; padding-bottom: 6px; }

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  width: 100%;
  background: rgba(255,255,255,0.5);
  transform-origin: left;
  animation: toast-countdown linear forwards;
}
@keyframes toast-countdown {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}

.toast-action-btn {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  cursor: pointer;
  margin-right: 4px;
  white-space: nowrap;
}
.toast-action-btn:hover { background: rgba(255,255,255,0.35); }
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useToast.js src/components/Toast.jsx src/styles.css
git commit -m "feat: toast supports action buttons and progress bar countdown"
```

---

## Task 3: pendingArchiveIds + handleStatusChange + ArchiveSection

**Files:**
- Modify: `src/App.jsx`
- Create: `src/components/ArchiveSection.jsx`
- Modify: `src/components/TopicView.jsx`

**Interfaces:**
- `pendingArchiveIds`: `Set<string>` of entry IDs marked done but timer still running
- `handleStatusChange(entryId, status)` — when status === 'done' and `archiveToast` is true: add to pendingArchiveIds, fire toast with Undo; else archive immediately
- `handleUndoArchive(entryId, prevStatus)` — reverts status to prevStatus, removes from pendingArchiveIds
- `ArchiveSection` props: `topicId: string`, `supabase` — loads done entries for topic on demand

- [ ] **Step 1: Add pendingArchiveIds state and modify handleStatusChange in App.jsx**

```jsx
const [pendingArchiveIds, setPendingArchiveIds] = useState(new Set())
```

Replace the existing `handleStatusChange`:
```jsx
async function handleStatusChange(entryId, status) {
  const entry = entries.find(e => e.id === entryId)
  const prevStatus = entry?.status || null
  const updated = await updateEntry(supabase, entryId, { status })
  setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e)))

  if (status === 'done') {
    if (archiveToast) {
      setPendingArchiveIds((prev) => new Set([...prev, entryId]))
      addToast(
        'Moved to archive',
        'info',
        {
          duration: 3000,
          actions: [{ label: 'Undo', onClick: () => handleUndoArchive(entryId, prevStatus) }],
          onExpire: () => setPendingArchiveIds((prev) => { const next = new Set(prev); next.delete(entryId); return next }),
        }
      )
    }
  } else {
    // If re-opened from done, remove from pending if present
    setPendingArchiveIds((prev) => { const next = new Set(prev); next.delete(entryId); return next })
  }
}

async function handleUndoArchive(entryId, prevStatus) {
  const updated = await updateEntry(supabase, entryId, { status: prevStatus })
  setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...updated, tags: e.tags } : e)))
  setPendingArchiveIds((prev) => { const next = new Set(prev); next.delete(entryId); return next })
}
```

On topic change (selectedId changes), commit all pending:
```jsx
useEffect(() => {
  if (pendingArchiveIds.size > 0) {
    setPendingArchiveIds(new Set())
  }
}, [selectedId])
```

Pass to TopicView:
```jsx
<TopicView ... pendingArchiveIds={pendingArchiveIds} />
```

- [ ] **Step 2: Create ArchiveSection.jsx**

```jsx
import { useState } from 'react'
import { listArchivedEntriesByTopic } from '../lib/db/entries.js'

export default function ArchiveSection({ topicId, supabase, onStatusChange, onDelete }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(null)

  async function load() {
    setLoading(true)
    const data = await listArchivedEntriesByTopic(supabase, topicId)
    setEntries(data)
    setCount(data.length)
    setLoading(false)
    setOpen(true)
  }

  if (!open) {
    return (
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button
          className="load-more-btn"
          onClick={load}
          disabled={loading}
          style={{ opacity: 0.7 }}
        >
          {loading ? 'Loading…' : `Show archived entries${count !== null ? ` (${count})` : ''}`}
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <p className="section-label" style={{ margin: 0 }}>Archived ({entries.length})</p>
        <button
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={() => setOpen(false)}
        >Hide</button>
      </div>
      {entries.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No archived entries.</p>}
      {entries.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
          <span style={{ flex: 1 }}>{e.title || e.url || 'Untitled'}</span>
          <button style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => onStatusChange(e.id, 'backlog')}>Unarchive</button>
          <button style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)' }} onClick={() => onDelete(e.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Add listArchivedEntriesByTopic to entries.js**

In `src/lib/db/entries.js`, add:
```js
export async function listArchivedEntriesByTopic(supabase, topicId) {
  const { data, error } = await supabase
    .from('entries')
    .select(TAG_SELECT)
    .eq('topic_id', topicId)
    .eq('status', 'done')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(flattenTags)
}
```

- [ ] **Step 4: Filter done entries in TopicView + add ArchiveSection**

In TopicView, accept `pendingArchiveIds` prop. Update the `filtered` entries to exclude done entries that are not pending:

```jsx
export default function TopicView({ ..., pendingArchiveIds = new Set() }) {
```

Update the `filtered` memo — add a final filter step:
```jsx
const filtered = useMemo(() => {
  let result
  if (filteredByTag !== null) {
    result = filteredByTag
  } else if (scope === 'all') {
    result = globalSearchResults ?? fuzzyFind(query, entries, ['title', 'note'])
  } else {
    let pool = scope === 'doc' ? entries.filter((e) => docEmbedIds.has(e.id)) : entries
    result = fuzzyFind(query, pool, ['title', 'note'])
  }
  // Hide done entries unless they're pending archive (timer still running)
  return result.filter(e => e.status !== 'done' || pendingArchiveIds.has(e.id))
}, [entries, query, scope, docEmbedIds, globalSearchResults, filteredByTag, pendingArchiveIds])
```

Add `ArchiveSection` import at top of TopicView:
```jsx
import ArchiveSection from './ArchiveSection.jsx'
import { supabase } from '../lib/supabaseClient.js'
```

Add ArchiveSection at the bottom of the TopicView return, after `<EntryList>` and before `{returnY != null && <ReturnButton>}`:
```jsx
<ArchiveSection
  key={topic.id}
  topicId={topic.id}
  supabase={supabase}
  onStatusChange={onStatusChange}
  onDelete={onDelete}
/>
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/components/EntryCard.test.jsx src/components/EntryList.test.jsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/ArchiveSection.jsx src/components/TopicView.jsx src/lib/db/entries.js
git commit -m "feat: done entries archive with 3s undo toast and archive section in topic view"
```
