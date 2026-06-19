# Files Tab — Design Spec

**Date:** 2026-06-19
**Status:** Approved

---

## Goal

Give users a dedicated screen to browse, sort, and delete their uploaded attachments, with per-user storage usage visibility and a hard 500MB cap enforced at upload time.

---

## Storage Backend

Supabase Storage (`attachments` bucket). Files are stored at `{user.id}/{uuid}-{filename}`. The Supabase Storage `list()` API returns `name`, `metadata.size`, `metadata.mimetype`, and `created_at` per file. No new DB table needed.

The 1GB project-wide free-tier limit is an operator concern — not surfaced to users. Users see only their own usage vs. their personal 500MB cap.

---

## Layout

New sidebar nav item: **Files**, `FolderOpen` lucide icon, `view === 'files'`. Positioned after Trash in the nav list.

```
┌─────────────────────────────────────────────────────┐
│  Your Files                                          │
│                                                      │
│  ████████████████░░░░░░░░░░  210 MB of 500 MB       │
│  ⚠ Approaching limit — delete files to free space   │
│                                                      │
│  Sort by: [Date ▾] [Size] [Type]      30 shown       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🖼  hero-image.png        2.4 MB  Jun 14     │   │
│  │    Used in: AI essay (link), Work notes (link)│  │
│  ├──────────────────────────────────────────────┤   │
│  │ 📄  paper.pdf             1.1 MB  Jun 12     │   │
│  │    Used in: —                                │   │
│  ├──────────────────────────────────────────────┤   │
│  │ 🖼  diagram.webp          840 KB  Jun 10     │   │
│  │    Used in: CS notes (link)                  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [Load more]                                         │
└─────────────────────────────────────────────────────┘
```

Mobile: same layout, single column, storage bar stacks above list.

---

## Components

### `FilesView.jsx`

Root component. Receives `supabase` prop from App.jsx. Owns all state: file list, sort order, page size, loading state.

On mount: calls `supabase.storage.from('attachments').list(userId, { sortBy: { column: 'created_at', order: 'desc' } })` with no limit (fetches all — max ~50 files per user at 10MB cap). Sorts and paginates client-side. Re-fetches after any delete.

**State:**
- `files` — full list from Storage
- `sortBy` — `'date' | 'size' | 'type'` (default: `'date'`)
- `pageSize` — number shown, starts at 30, increments by 30 on "Load more"
- `loading` — boolean
- `deleteTarget` — file object queued for delete confirm modal, or null

**Derived:**
- `sorted` — `files` sorted by `sortBy`
- `visible` — `sorted.slice(0, pageSize)`
- `totalBytes` — `files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0)`
- `usagePct` — `totalBytes / (500 * 1024 * 1024) * 100`

### `StorageBar.jsx`

Props: `totalBytes`, `capBytes` (500MB).

Renders: filled progress bar, "X MB of 500 MB", warning text at ≥ 80% (`⚠ Approaching limit — delete files to free space`). No warning below 80%.

### `FileRow.jsx`

Props: `file`, `supabase`, `onDeleteClick`.

Displays: thumbnail (images) or filetype icon (PDF = `FileText` lucide icon), filename, human-readable size, upload date (`Jun 14` format), entry references row, delete button.

**Entry references (lazy-loaded):** On mount, queries:
```js
supabase
  .from('entries')
  .select('id, title, topic_id, topics(name)')
  .like('note', `%${publicUrl}%`)
  .is('deleted_at', null)
```
Shows "Used in:" followed by entry titles as quicklinks. Clicking a quicklink calls `onSelectEntry(entry)` → App.jsx sets `selectedId = entry.topic_id` + `view = 'browse'` + scrolls to `#entry-{entry.id}` after a short delay. If no references: "Used in: —".

**Thumbnail:** For `image/*` mime types, renders `<img src={publicUrl} />` constrained to 48×48px, object-fit cover. For PDFs, renders `<FileText size={32} />`.

**Delete button:** `Trash2` icon, calls `onDeleteClick(file)`.

### Delete Confirm Modal

Reuses existing `ConfirmModal.jsx`. Message: "Delete **{filename}**? This will break any entries that embed it." If entry references were found, lists them below: "Referenced in: [Entry Title], [Entry Title]." Confirm label: "Delete file". On confirm: `supabase.storage.from('attachments').remove([path])` → re-fetch file list.

### Sort Controls

Three pill buttons: Date | Size | Type. Active pill highlighted with accent color. Sorting logic:
- **Date:** `created_at` descending (newest first)
- **Size:** `metadata.size` descending (largest first)
- **Type:** group images before PDFs, then alphabetical by name within group

---

## Upload Enforcement (in `src/lib/storage.js`)

Before every upload, check the user's current total usage:

```js
const CAP_BYTES = 500 * 1024 * 1024  // 500 MB

async function getUserUsageBytes(supabase, userId) {
  const { data } = await supabase.storage.from('attachments').list(userId)
  return (data || []).reduce((sum, f) => sum + (f.metadata?.size || 0), 0)
}
```

In `uploadAttachment`, after auth check and before upload:
```js
const used = await getUserUsageBytes(supabase, user.id)
if (used + file.size > CAP_BYTES) {
  throw new Error(`Storage limit reached. You've used ${formatMB(used)} of 500 MB. Delete files to upload more.`)
}
```

The error surfaces in the NoteEditor upload flow as a toast (existing error handling already catches upload errors and shows them).

---

## Data Flow

```
App.jsx
  └── FilesView (view === 'files')
        ├── StorageBar        ← totalBytes (derived from file list)
        ├── Sort controls     ← sortBy state
        ├── FileRow[]         ← visible files, supabase, onDeleteClick, onSelectEntry
        │     └── entry reference query (lazy, per row)
        └── Delete modal      ← deleteTarget, onConfirm → remove() → re-fetch

uploadAttachment (src/lib/storage.js)
  └── getUserUsageBytes()    ← called before every upload, throws if over cap
```

App.jsx additions:
- `view === 'files'` renders `<FilesView supabase={supabase} onSelectEntry={handleSelectEntry} />`
- `handleSelectEntry({ id, topic_id })` → sets `selectedId = topic_id`, `setView('browse')`, stores pending scroll target in a ref, scrolls to `#entry-{id}` after `listEntriesByTopic` resolves

---

## New Files

```
src/components/FilesView.jsx
src/components/StorageBar.jsx
src/components/FileRow.jsx
```

## Modified Files

```
src/App.jsx          — add 'files' view, Files nav item, handleSelectEntry
src/lib/storage.js   — add CAP_BYTES, getUserUsageBytes, enforce cap in uploadAttachment
src/styles.css       — FilesView layout, StorageBar, FileRow, sort pills
```

---

## What's Not In This Spec

- **R2/S3 migration** — future task; the storage abstraction in `storage.js` makes this a one-file swap when ready
- **Admin dashboard** — separate future spec; will surface per-user usage aggregates and threshold controls for free/paid tiers
- **Bulk delete** — not in scope; single-file delete with confirm is sufficient
- **Round-trip ZIP import** — separate spec; Files tab is a prerequisite (users need to manage storage before importing large exports)
