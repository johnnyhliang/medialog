# Wayback Machine Archive Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users archive individual entry URLs to the Wayback Machine and check snapshot status, with a bulk archiver in Settings that respects rate limits.

**Architecture:** A pure `wayback.js` lib module wraps two Wayback APIs (availability check + Save Page Now submit). `WaybackPopup.jsx` is a modal opened from the entry card's secondary actions panel — it fetches live on open and lets the user submit. Settings gets a bulk archiver section that queues a topic's URLs and submits them one at a time with a 5-second delay. A single DB column `wayback_submitted_at` on `entries` persists the user's own submission timestamp.

**Tech Stack:** React, Supabase JS, Wayback Machine public APIs (no auth), Vitest + Testing Library

## Global Constraints

- No hover-triggered UI — archive button is always-visible in the secondary actions panel
- Save Page Now rate limit: 1 request per 5 seconds (anonymous); bulk archiver enforces this
- Only entries where `entry.url` is non-null are eligible for archiving
- `wayback_submitted_at` records when the user last submitted via this app, not when archive.org crawled
- Wayback availability API: `GET https://archive.org/wayback/available?url={url}`
- Save Page Now: `POST https://web.archive.org/save/{url}` (no body, no auth headers)
- Availability API timestamp format from response: `YYYYMMDDHHmmss` — must convert to ISO before use

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/0017_wayback.sql` | Create | Add `wayback_submitted_at` column to entries |
| `src/lib/wayback.js` | Create | `checkArchive(url)` and `submitArchive(url)` |
| `src/lib/wayback.test.js` | Create | Unit tests for both functions |
| `src/components/WaybackPopup.jsx` | Create | Modal: live check + submit button |
| `src/components/WaybackPopup.test.jsx` | Create | Render + interaction tests |
| `src/components/EntryCard.jsx` | Modify | Add Archive button to secondary actions; render WaybackPopup |
| `src/components/SettingsView.jsx` | Modify | Add bulk archiver section |

---

### Task 1: DB migration — add `wayback_submitted_at` to entries

**Files:**
- Create: `supabase/migrations/0017_wayback.sql`

**Interfaces:**
- Produces: `entries.wayback_submitted_at` column (timestamptz, nullable). All later tasks read/write this field via the existing `updateEntry(supabase, id, patch)` function in `src/lib/db/entries.js`.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0017_wayback.sql
alter table entries add column if not exists wayback_submitted_at timestamptz;
```

- [ ] **Step 2: Apply locally**

```bash
npx supabase db push
```

Expected: migration applies without error.

- [ ] **Step 3: Verify column exists**

Open Supabase Studio or run:
```bash
npx supabase db diff
```
Expected: no pending diff (migration is applied).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0017_wayback.sql
git commit -m "feat: add wayback_submitted_at column to entries"
```

---

### Task 2: `src/lib/wayback.js` — Wayback API wrappers

**Files:**
- Create: `src/lib/wayback.js`
- Create: `src/lib/wayback.test.js`

**Interfaces:**
- Produces:
  ```js
  // Returns { archived: boolean, timestamp: string|null, snapshotUrl: string|null }
  // timestamp is ISO 8601 string, e.g. "2024-03-15T10:22:00.000Z"
  export async function checkArchive(url: string): Promise<{ archived: boolean, timestamp: string|null, snapshotUrl: string|null }>

  // Returns { snapshotUrl: string } on success. Throws Error on failure.
  export async function submitArchive(url: string): Promise<{ snapshotUrl: string }>
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/wayback.test.js`:

```js
import { vi, test, expect, beforeEach } from 'vitest'
import { checkArchive, submitArchive } from './wayback.js'

beforeEach(() => { vi.restoreAllMocks() })

test('checkArchive returns archived=true with ISO timestamp when snapshot exists', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      archived_snapshots: {
        closest: {
          available: true,
          timestamp: '20240315102200',
          url: 'https://web.archive.org/web/20240315102200/https://example.com',
        },
      },
    }),
  }))

  const result = await checkArchive('https://example.com')

  expect(result.archived).toBe(true)
  expect(result.timestamp).toBe('2024-03-15T10:22:00.000Z')
  expect(result.snapshotUrl).toBe('https://web.archive.org/web/20240315102200/https://example.com')
})

test('checkArchive returns archived=false when no snapshot', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ archived_snapshots: {} }),
  }))

  const result = await checkArchive('https://example.com')

  expect(result.archived).toBe(false)
  expect(result.timestamp).toBeNull()
  expect(result.snapshotUrl).toBeNull()
})

test('checkArchive throws when fetch fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
  await expect(checkArchive('https://example.com')).rejects.toThrow('network error')
})

test('submitArchive returns snapshotUrl parsed from Content-Location header', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: (h) => h === 'Content-Location' ? '/web/20260620120000/https://example.com' : null },
  }))

  const result = await submitArchive('https://example.com')

  expect(result.snapshotUrl).toBe('https://web.archive.org/web/20260620120000/https://example.com')
})

test('submitArchive throws on non-2xx response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
    headers: { get: () => null },
  }))

  await expect(submitArchive('https://example.com')).rejects.toThrow('429')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/wayback.test.js
```

Expected: FAIL — "Cannot find module './wayback.js'"

- [ ] **Step 3: Implement `src/lib/wayback.js`**

```js
function parseWaybackTimestamp(ts) {
  // ts format: YYYYMMDDHHmmss
  const y = ts.slice(0, 4), mo = ts.slice(4, 6), d = ts.slice(6, 8)
  const h = ts.slice(8, 10), mi = ts.slice(10, 12), s = ts.slice(12, 14)
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString()
}

export async function checkArchive(url) {
  const res = await fetch(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`
  )
  const data = await res.json()
  const closest = data?.archived_snapshots?.closest
  if (!closest?.available) {
    return { archived: false, timestamp: null, snapshotUrl: null }
  }
  return {
    archived: true,
    timestamp: parseWaybackTimestamp(closest.timestamp),
    snapshotUrl: closest.url,
  }
}

export async function submitArchive(url) {
  const res = await fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Save Page Now failed: ${res.status}`)
  const loc = res.headers.get('Content-Location')
  const snapshotUrl = loc
    ? `https://web.archive.org${loc}`
    : `https://web.archive.org/web/*/${url}`
  return { snapshotUrl }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/wayback.test.js
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wayback.js src/lib/wayback.test.js
git commit -m "feat: wayback.js — checkArchive and submitArchive API wrappers"
```

---

### Task 3: `WaybackPopup.jsx` — archive status modal

**Files:**
- Create: `src/components/WaybackPopup.jsx`
- Create: `src/components/WaybackPopup.test.jsx`

**Interfaces:**
- Consumes:
  ```js
  // From Task 2
  import { checkArchive, submitArchive } from '../lib/wayback.js'
  // From existing codebase
  import Modal from './Modal.jsx'                          // onClose, children, label props
  import { updateEntry } from '../lib/db/entries.js'      // updateEntry(supabase, id, patch)
  ```
- Props:
  ```js
  // entry: { id, url, wayback_submitted_at, title }
  // supabase: supabase client instance
  // onClose: () => void
  // onEntryUpdate: (updatedEntry) => void  — called after successful submit
  WaybackPopup({ entry, supabase, onClose, onEntryUpdate })
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/components/WaybackPopup.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, beforeEach } from 'vitest'
import WaybackPopup from './WaybackPopup.jsx'

vi.mock('../lib/wayback.js', () => ({
  checkArchive: vi.fn(),
  submitArchive: vi.fn(),
}))
vi.mock('../lib/db/entries.js', () => ({
  updateEntry: vi.fn(),
}))

import { checkArchive, submitArchive } from '../lib/wayback.js'
import { updateEntry } from '../lib/db/entries.js'

const entry = { id: 'e1', url: 'https://example.com', title: 'Example', wayback_submitted_at: null }
const supabase = {}
const noop = () => {}

beforeEach(() => { vi.clearAllMocks() })

test('shows loading then archived status', async () => {
  checkArchive.mockResolvedValue({ archived: true, timestamp: '2024-01-15T10:00:00.000Z', snapshotUrl: 'https://web.archive.org/web/20240115/https://example.com' })

  render(<WaybackPopup entry={entry} supabase={supabase} onClose={noop} onEntryUpdate={noop} />)

  expect(screen.getByText(/checking/i)).toBeTruthy()
  await waitFor(() => expect(screen.getByText(/last archived/i)).toBeTruthy())
  expect(screen.getByRole('link', { name: /view snapshot/i })).toBeTruthy()
})

test('shows never archived when no snapshot', async () => {
  checkArchive.mockResolvedValue({ archived: false, timestamp: null, snapshotUrl: null })

  render(<WaybackPopup entry={entry} supabase={supabase} onClose={noop} onEntryUpdate={noop} />)

  await waitFor(() => expect(screen.getByText(/never archived/i)).toBeTruthy())
})

test('submit button calls submitArchive and updateEntry', async () => {
  checkArchive.mockResolvedValue({ archived: false, timestamp: null, snapshotUrl: null })
  submitArchive.mockResolvedValue({ snapshotUrl: 'https://web.archive.org/web/20260620/https://example.com' })
  updateEntry.mockResolvedValue({ ...entry, wayback_submitted_at: '2026-06-20T00:00:00.000Z' })

  const onEntryUpdate = vi.fn()
  render(<WaybackPopup entry={entry} supabase={supabase} onClose={noop} onEntryUpdate={onEntryUpdate} />)

  await waitFor(() => screen.getByRole('button', { name: /archive now/i }))
  await userEvent.click(screen.getByRole('button', { name: /archive now/i }))

  await waitFor(() => expect(submitArchive).toHaveBeenCalledWith('https://example.com'))
  expect(updateEntry).toHaveBeenCalledWith(supabase, 'e1', expect.objectContaining({ wayback_submitted_at: expect.any(String) }))
  expect(onEntryUpdate).toHaveBeenCalled()
})

test('shows previously submitted date when wayback_submitted_at is set', async () => {
  checkArchive.mockResolvedValue({ archived: true, timestamp: '2024-01-15T10:00:00.000Z', snapshotUrl: 'https://web.archive.org/web/20240115/https://example.com' })
  const submittedEntry = { ...entry, wayback_submitted_at: '2026-06-20T12:00:00.000Z' }

  render(<WaybackPopup entry={submittedEntry} supabase={supabase} onClose={noop} onEntryUpdate={noop} />)

  await waitFor(() => expect(screen.getByText(/you submitted this/i)).toBeTruthy())
})

test('shows error when checkArchive throws', async () => {
  checkArchive.mockRejectedValue(new Error('network error'))

  render(<WaybackPopup entry={entry} supabase={supabase} onClose={noop} onEntryUpdate={noop} />)

  await waitFor(() => expect(screen.getByText(/couldn't reach/i)).toBeTruthy())
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/WaybackPopup.test.jsx
```

Expected: FAIL — "Cannot find module './WaybackPopup.jsx'"

- [ ] **Step 3: Implement `WaybackPopup.jsx`**

```jsx
import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { checkArchive, submitArchive } from '../lib/wayback.js'
import { updateEntry } from '../lib/db/entries.js'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function WaybackPopup({ entry, supabase, onClose, onEntryUpdate }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'done' | 'error'
  const [archiveInfo, setArchiveInfo] = useState(null) // { archived, timestamp, snapshotUrl }
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    checkArchive(entry.url)
      .then((info) => { setArchiveInfo(info); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [entry.url])

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitArchive(entry.url)
      const now = new Date().toISOString()
      const updated = await updateEntry(supabase, entry.id, { wayback_submitted_at: now })
      onEntryUpdate(updated)
      setSubmitted(true)
    } catch {
      setSubmitError('Submission failed — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} label="Wayback Machine" maxWidth="400px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, wordBreak: 'break-all' }}>{entry.url}</p>

        {status === 'loading' && <p className="muted">Checking archive…</p>}

        {status === 'error' && (
          <p className="muted">Couldn't reach the Wayback Machine. Check your connection.</p>
        )}

        {status === 'done' && archiveInfo && (
          <>
            {archiveInfo.archived ? (
              <p style={{ margin: 0, fontSize: 13 }}>
                Last archived {formatDate(archiveInfo.timestamp)} —{' '}
                <a href={archiveInfo.snapshotUrl} target="_blank" rel="noopener noreferrer">
                  view snapshot ↗
                </a>
              </p>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Never archived on the Wayback Machine.</p>
            )}

            {entry.wayback_submitted_at && !submitted && (
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                You submitted this on {formatDate(entry.wayback_submitted_at)}.
              </p>
            )}

            {submitted ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--accent)' }}>
                Submitted — archive.org will crawl this soon.
              </p>
            ) : (
              <button
                className="btn-small"
                onClick={handleSubmit}
                disabled={submitting}
                style={{ alignSelf: 'flex-start' }}
              >
                {submitting ? 'Submitting…' : 'Archive now'}
              </button>
            )}

            {submitError && <p className="muted" style={{ margin: 0, fontSize: 12 }}>{submitError}</p>}
          </>
        )}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/WaybackPopup.test.jsx
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/WaybackPopup.jsx src/components/WaybackPopup.test.jsx
git commit -m "feat: WaybackPopup — live archive check and submit modal"
```

---

### Task 4: Wire `WaybackPopup` into `EntryCard`

**Files:**
- Modify: `src/components/EntryCard.jsx`
- Modify: `src/components/EntryList.jsx`

**Interfaces:**
- Consumes:
  ```js
  // From Task 3
  import WaybackPopup from './WaybackPopup.jsx'
  // Props added to EntryCard:
  // onArchive: (entry) => void   — called to open the popup (handled in EntryCard itself now, see below)
  // onEntryUpdate: (updatedEntry) => void  — passed down from EntryList
  // supabase: supabase client instance
  ```
- Note: `WaybackPopup` is rendered inside `EntryCard` itself (not in `EntryList`), managing its own `showWayback` state. `onEntryUpdate` is the only new prop needed from `EntryList`.

- [ ] **Step 1: Add `showWayback` state and Archive button to `EntryCard`**

In `src/components/EntryCard.jsx`, make the following changes:

**a) Add import at top:**
```jsx
import { Archive } from 'lucide-react'
import WaybackPopup from './WaybackPopup.jsx'
```

**b) Add to existing lucide-react import line** (replace the existing import):
```jsx
import { ChevronUp, Clock, MoreVertical, Pencil, Pin, PinOff, Plus, Trash2, Archive } from 'lucide-react'
```

**c) Add new prop to component signature** (replace existing signature):
```jsx
export default function EntryCard({ entry, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onNoteVersion, onShowHistory, onTitleChange, moveTargets, onMove, tagColors, onEntryUpdate, supabase }) {
```

**d) Add state** after the existing `useState` declarations (around line 61):
```jsx
const [showWayback, setShowWayback] = useState(false)
```

**e) Add Archive button inside the secondary actions block.** Find this existing block in `expandedBody`:
```jsx
<div className="card-secondary-actions" style={{ display: showSecondaryActions ? 'flex' : undefined, gap: 'inherit' }}>
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

Replace with:
```jsx
<div className="card-secondary-actions" style={{ display: showSecondaryActions ? 'flex' : undefined, gap: 'inherit' }}>
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
  {entry.url && (
    <button
      className="icon-btn"
      aria-label="archive to Wayback Machine"
      title="Wayback Machine"
      onClick={(e) => { e.stopPropagation(); setShowWayback(true) }}
    >
      <Archive size={15} />
    </button>
  )}
  {moveSelect}
</div>
```

**f) Add WaybackPopup render** inside the returned JSX, alongside the existing `{confirmDelete && ...}` block:
```jsx
{showWayback && (
  <WaybackPopup
    entry={entry}
    supabase={supabase}
    onClose={() => setShowWayback(false)}
    onEntryUpdate={(updated) => { onEntryUpdate?.(updated); setShowWayback(false) }}
  />
)}
```

- [ ] **Step 2: Pass new props through `EntryList`**

In `src/components/EntryList.jsx`, add `onEntryUpdate` and `supabase` to props and pass them to `EntryCard`:

```jsx
import { useState } from 'react'
import { supabase as supabaseClient } from '../lib/supabaseClient.js'
import EntryCard from './EntryCard.jsx'
import EmptyState from './EmptyState.jsx'

const PAGE_SIZE = 50

export default function EntryList({ entries, onDelete, onStatusChange, onTagsChange, onTogglePin, onNoteSave, onPreview, onNoteVersion, onShowHistory, onTitleChange, moveTargets, onMove, tagColors, onEntryUpdate }) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  if (entries.length === 0) return <EmptyState message="No entries yet." />

  const visible = entries.slice(0, limit)
  const remaining = entries.length - visible.length

  return (
    <div>
      <div className="entry-list-grid">
        {visible.map((e) => (
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
            moveTargets={moveTargets}
            onMove={onMove}
            tagColors={tagColors}
            onEntryUpdate={onEntryUpdate}
            supabase={supabaseClient}
          />
        ))}
      </div>
      {remaining > 0 && (
        <button
          className="load-more-btn"
          onClick={() => setLimit((l) => l + PAGE_SIZE)}
        >
          Show {remaining} more
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Pass `onEntryUpdate` from App.jsx to EntryList**

In `src/App.jsx`, find where `<EntryList` is rendered (search for `<EntryList`) and add `onEntryUpdate`:

```jsx
onEntryUpdate={(updated) => {
  setEntries((prev) => prev.map((e) => e.id === updated.id ? { ...e, ...updated } : e))
}}
```

- [ ] **Step 4: Verify manually**

Start dev server:
```bash
npm run dev
```
1. Open a topic with entries that have URLs
2. Click a card to expand it
3. Click `⋮` (More actions) — Archive icon (box with arrow) should appear in secondary actions
4. Click Archive icon — WaybackPopup modal opens
5. Modal shows loading then snapshot date (or "Never archived")
6. Click "Archive now" — button changes to "Submitting…" then "Submitted"
7. Close and reopen the modal — "You submitted this on [today]" appears

- [ ] **Step 5: Commit**

```bash
git add src/components/EntryCard.jsx src/components/EntryList.jsx src/App.jsx
git commit -m "feat: Archive button in entry card secondary actions opens WaybackPopup"
```

---

### Task 5: Bulk archiver in Settings

**Files:**
- Modify: `src/components/SettingsView.jsx`

**Interfaces:**
- Consumes:
  ```js
  // From Task 2
  import { submitArchive } from '../lib/wayback.js'
  // Existing in SettingsView scope
  // supabase — already imported from '../lib/supabaseClient.js'
  // topics — already a prop: topics: Array<{ id: string, name: string }>
  // addToast — already a prop: addToast(message: string, type: string) => void
  // Also needs entries by topic — fetch via listEntriesByTopic from db/entries.js
  import { listEntriesByTopic } from '../lib/db/entries.js'
  import { updateEntry } from '../lib/db/entries.js'
  ```

- [ ] **Step 1: Add bulk archiver state and logic to `SettingsView.jsx`**

Add these imports at the top of `src/components/SettingsView.jsx` (after existing imports):
```js
import { submitArchive } from '../lib/wayback.js'
import { listEntriesByTopic, updateEntry } from '../lib/db/entries.js'
```

Add these state variables inside the `SettingsView` component (after existing state):
```js
const [bulkTopic, setBulkTopic] = useState('')
const [skipSubmitted, setSkipSubmitted] = useState(true)
const [bulkRunning, setBulkRunning] = useState(false)
const [bulkPaused, setBulkPaused] = useState(false)
const [bulkProgress, setBulkProgress] = useState(null) // { done: number, total: number, errors: string[] }
const bulkPausedRef = useRef(false)
const bulkCancelledRef = useRef(false)
```

Add this import at the top of the component file (with other React imports):
```js
import { useState, useEffect, useRef } from 'react'
```

Add the `handleBulkArchive` function inside the component:
```js
async function handleBulkArchive() {
  if (!bulkTopic) return
  setBulkRunning(true)
  setBulkPaused(false)
  bulkPausedRef.current = false
  bulkCancelledRef.current = false

  const entries = await listEntriesByTopic(supabase, bulkTopic)
  let queue = entries.filter((e) => e.url)
  if (skipSubmitted) queue = queue.filter((e) => !e.wayback_submitted_at)

  setBulkProgress({ done: 0, total: queue.length, errors: [] })

  for (let i = 0; i < queue.length; i++) {
    if (bulkCancelledRef.current) break

    while (bulkPausedRef.current) {
      await new Promise((r) => setTimeout(r, 200))
      if (bulkCancelledRef.current) break
    }
    if (bulkCancelledRef.current) break

    const entry = queue[i]
    try {
      await submitArchive(entry.url)
      await updateEntry(supabase, entry.id, { wayback_submitted_at: new Date().toISOString() })
    } catch {
      setBulkProgress((p) => ({ ...p, errors: [...p.errors, entry.url] }))
    }

    setBulkProgress((p) => ({ ...p, done: i + 1 }))

    if (i < queue.length - 1) {
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  setBulkRunning(false)
}

function handlePause() {
  bulkPausedRef.current = true
  setBulkPaused(true)
}

function handleResume() {
  bulkPausedRef.current = false
  setBulkPaused(false)
}

function handleCancel() {
  bulkCancelledRef.current = true
  bulkPausedRef.current = false
  setBulkRunning(false)
  setBulkPaused(false)
  setBulkProgress(null)
}
```

- [ ] **Step 2: Add bulk archiver UI section to the render**

Find the closing `</div>` at the end of the `SettingsView` return (just before the final `}`). Insert this section before it:

```jsx
<section style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, marginTop: 0 }}>Bulk archive to Wayback Machine</h3>
  <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
    Submits all URLs in a topic to archive.org one at a time, with a 5-second gap to stay within rate limits.
  </p>

  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
    <select
      className="explore-filter-select"
      value={bulkTopic}
      onChange={(e) => setBulkTopic(e.target.value)}
      disabled={bulkRunning}
    >
      <option value="">Select a topic…</option>
      {topics.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>

    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={skipSubmitted}
        onChange={(e) => setSkipSubmitted(e.target.checked)}
        disabled={bulkRunning}
      />
      Skip already submitted entries
    </label>

    {!bulkRunning && (
      <button
        className="btn-small"
        onClick={handleBulkArchive}
        disabled={!bulkTopic}
        style={{ alignSelf: 'flex-start' }}
      >
        Start archiving
      </button>
    )}

    {bulkRunning && bulkProgress && (
      <>
        <div style={{ fontSize: 13 }}>
          {bulkProgress.done} / {bulkProgress.total} submitted
        </div>
        <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div
            style={{
              background: 'var(--accent)',
              height: '100%',
              width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {bulkPaused ? (
            <button className="btn-small" onClick={handleResume}>Resume</button>
          ) : (
            <button className="btn-small btn-ghost" onClick={handlePause}>Pause</button>
          )}
          <button className="btn-small btn-ghost" onClick={handleCancel}>Cancel</button>
        </div>
      </>
    )}

    {!bulkRunning && bulkProgress && bulkProgress.done === bulkProgress.total && (
      <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0 }}>
        Done — {bulkProgress.total} URLs submitted.
        {bulkProgress.errors.length > 0 && (
          <> {bulkProgress.errors.length} failed: {bulkProgress.errors.join(', ')}</>
        )}
      </p>
    )}
  </div>
</section>
```

- [ ] **Step 3: Verify manually**

```bash
npm run dev
```
1. Open Settings
2. Scroll to "Bulk archive to Wayback Machine" section
3. Select a topic from the dropdown
4. Click "Start archiving"
5. Progress bar increments, updates every 5 seconds
6. Pause button works — resumes where it left off
7. Cancel resets the UI
8. On completion: "Done — N URLs submitted"

- [ ] **Step 4: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all existing tests pass, new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsView.jsx
git commit -m "feat: bulk Wayback Machine archiver in Settings with pause/cancel and progress bar"
```
