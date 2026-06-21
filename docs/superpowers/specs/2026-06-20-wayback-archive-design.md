# Wayback Machine Archive Feature Design

## Goal

Let users archive individual entry URLs to the Wayback Machine and check when they were last archived, with a bulk archiver in Settings for topic-level submissions that respects rate limits.

## Architecture

Three units of new code, one DB change:

1. **`src/lib/wayback.js`** — two pure async functions wrapping Wayback APIs. No auth, no proxy.
2. **`src/components/WaybackPopup.jsx`** — modal opened from the "..." overflow menu on entry cards. Fetches live on open.
3. **Settings bulk archiver** — new section in `SettingsView.jsx`. Client-side queue with 5s delay between submissions.
4. **DB migration** — adds `wayback_submitted_at timestamptz` to `entries`.

No caching of availability checks — the API is fast (~200ms) and free. Only the user's own submission timestamp is persisted.

## Global Constraints

- No hover-triggered UI anywhere in this feature
- Save Page Now rate limit: max 1 request per 5 seconds (anonymous)
- Only entries with a non-null `url` are eligible for archiving
- `wayback_submitted_at` records when the user last submitted, not when archive.org crawled

---

## Unit 1: `src/lib/wayback.js`

Two exported functions:

```js
// Returns { archived: boolean, timestamp: string | null, snapshotUrl: string | null }
// timestamp is ISO string of most recent snapshot, e.g. "2024-03-15T10:22:00Z"
// snapshotUrl is the full https://web.archive.org/web/... URL
export async function checkArchive(url)

// Submits url to Save Page Now (https://web.archive.org/save/{url})
// Returns { snapshotUrl: string } on success
// Throws on network error or non-2xx response
export async function submitArchive(url)
```

**`checkArchive`** calls:
```
GET https://archive.org/wayback/available?url={encodeURIComponent(url)}
```
Response shape: `{ archived_snapshots: { closest: { available, timestamp, url } } }`
- `timestamp` format from API is `YYYYMMDDHHmmss` — convert to ISO before returning.
- If `closest` is absent or `available` is false, return `{ archived: false, timestamp: null, snapshotUrl: null }`.

**`submitArchive`** calls:
```
POST https://web.archive.org/save/{encodeURIComponent(url)}
```
- Check response status: 200 means queued. Non-2xx throws with a readable message.
- Parse `Content-Location` header for the snapshot URL (e.g. `/web/20260620.../https://example.com`). Prefix with `https://web.archive.org` to build `snapshotUrl`.

---

## Unit 2: `src/components/WaybackPopup.jsx`

A modal (reuses existing `Modal.jsx`) triggered from the "..." overflow menu on `EntryCard`. Only rendered for entries where `entry.url` is non-null.

**Trigger:** new "Archive" menu item in the EntryCard overflow menu. Always visible (not hover-dependent).

**On mount:** calls `checkArchive(entry.url)`. Shows a spinner while loading.

**Loaded state:**

- If archived: "Last archived [relative date] — [link to snapshot ↗]"
- If never archived: "Never archived on the Wayback Machine"
- "Archive now" button — calls `submitArchive(entry.url)`, then:
  - Calls `updateEntry(supabase, entry.id, { wayback_submitted_at: new Date().toISOString() })`
  - Shows success: "Submitted — archive.org will crawl this soon"
  - Button becomes disabled with label "Submitted"
- If `entry.wayback_submitted_at` is set: shows "You submitted this on [date]" below the button

**Error states:**
- `checkArchive` fails: "Couldn't reach the Wayback Machine"
- `submitArchive` fails: "Submission failed — try again"

Props: `{ entry, supabase, onClose, onEntryUpdate }`

---

## Unit 3: Settings bulk archiver

New section at the bottom of `SettingsView.jsx`, titled "Bulk archive to Wayback Machine".

**Controls:**
- Topic dropdown (all topics the user has)
- Checkbox: "Skip already submitted" (default: checked)
- "Start archiving" button

**On start:**
- Collect all entries in selected topic where `url` is not null
- If "skip already submitted" checked: exclude entries where `wayback_submitted_at` is not null
- Show count: "47 URLs to archive"
- Begin loop: for each URL, call `submitArchive`, update `wayback_submitted_at` on the entry, wait 5000ms, then next
- Progress bar: "12 / 47 submitted"
- "Pause" button mid-run (sets a ref flag, loop checks it before each request)
- "Cancel" button resets state entirely
- On completion: "Done — 47 URLs submitted"

**Error handling:** if a single URL fails, log it to an on-screen error list and continue. Don't abort the whole run.

---

## DB Migration

```sql
-- supabase/migrations/0016_wayback.sql
alter table entries add column wayback_submitted_at timestamptz;
```

No index needed — this column is only read when displaying individual entry data, never filtered or ordered on at scale.

---

## Wiring into existing components

**`EntryCard.jsx`:** add "Archive" item to the "..." overflow menu. Pass `onArchive` prop down from `EntryList` → `EntryCard`. `EntryList` renders `WaybackPopup` when `archiveEntry` state is set.

**`SettingsView.jsx`:** add bulk archiver section. Needs `supabase` and `topics` passed in (both already available in App.jsx where SettingsView is rendered).

**`src/lib/db/entries.js`:** `updateEntry` already handles arbitrary patch objects — no changes needed there.
