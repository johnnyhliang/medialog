# Auto-Embed, iOS Shortcut Guide & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-embed entries into pgvector on create/update so semantic search stays current, add an iOS Shortcut setup guide in Settings, and prune stale git worktrees.

**Architecture:** A thin `embedEntryAsync(supabase, entry)` util fires-and-forgets embedding after entry create/update at every call site in App.jsx. The iOS guide is a new Settings tab with copy-paste instructions referencing the existing `capture` edge function. Worktree prune is a one-shot git command.

**Tech Stack:** React + Vite, Supabase JS client, `supabase/functions/embed-entry` (Deno, already deployed), `supabase/functions/capture` (already deployed), Lucide icons, `src/styles.css` CSS variables.

## Global Constraints

- No TypeScript — plain JS/JSX only
- No new npm packages
- Styles in `src/styles.css` using existing CSS variables (`--surface-2`, `--border`, `--accent`, `--text-muted`, etc.)
- No comments explaining what code does — only non-obvious WHY
- `npm run build` must pass after every task
- Commit each task separately with a concise message

---

## Task 1: Auto-embed entries on save

Wire embedding into every entry create/update path so semantic search stays current without re-running the backfill script.

**Files:**
- Create: `src/lib/embedEntry.js`
- Modify: `src/App.jsx` — `handleAddEntry`, `handleNoteSave`, `handleBulkImport`, `handleArchiveImport`, `handleMigrationImport`, `handleSmartImport`

**Interfaces:**
- Produces: `embedEntryAsync(supabase, { id, title, note, url })` — fire-and-forget, never throws, returns void

**How the embed-entry edge function works:**
- `supabase.functions.invoke('embed-entry', { body: { text: string } })` — JWT is auto-attached by the SDK
- Returns `{ data: { embedding: number[] }, error }`
- After getting the embedding, upsert to `entry_embeddings`: `supabase.from('entry_embeddings').upsert({ entry_id: id, embedding, embedded_at: new Date().toISOString() })`

**`src/lib/embedEntry.js` — full implementation:**

```js
export async function embedEntryAsync(supabase, entry) {
  const text = [entry.title, entry.note, entry.url].filter(Boolean).join(' ').slice(0, 2000)
  if (!text.trim()) return
  try {
    const { data, error } = await supabase.functions.invoke('embed-entry', { body: { text } })
    if (error || !data?.embedding) return
    await supabase.from('entry_embeddings').upsert({
      entry_id: entry.id,
      embedding: data.embedding,
      embedded_at: new Date().toISOString(),
    })
  } catch {}
}
```

**Call sites in `src/App.jsx`:**

`handleAddEntry` — after the entry is created and title is resolved:
```js
async function handleAddEntry({ url, note, title: prefetchedTitle, tags = [] }) {
  const e = await createEntry(supabase, { topicId: selectedId, url, note })
  setEntries((prev) => [{ ...e, tags: [] }, ...prev])
  if (tags.length > 0) {
    await setEntryTags(supabase, e.id, tags)
    setEntries((prev) => prev.map((entry) => entry.id === e.id ? { ...entry, tags } : entry))
  }
  let finalEntry = e
  if (url) {
    const title = prefetchedTitle ?? await fetchTitle(supabase, url)
    if (title) {
      const updated = await updateEntry(supabase, e.id, { title })
      applyUpdateEntry(e.id, updated)
      finalEntry = updated
    }
  }
  embedEntryAsync(supabase, { ...finalEntry, note })
}
```

`handleNoteSave` — after update:
```js
async function handleNoteSave(entryId, note) {
  const updated = await updateEntry(supabase, entryId, { note })
  applyUpdateEntry(entryId, updated)
  embedEntryAsync(supabase, updated)
}
```

Bulk import handlers — after `bulkCreateEntries` returns, fire embedding for each created entry:
```js
// After bulkCreateEntries returns `created` array:
created.forEach(e => embedEntryAsync(supabase, e))
```
Apply this pattern to `handleBulkImport`, `handleArchiveImport`, `handleSmartImport`, and `handleMigrationImport` — each one already has a `created` or `allCreated` array after bulk insert.

- [ ] **Step 1: Create `src/lib/embedEntry.js`** with the implementation above

- [ ] **Step 2: Import in App.jsx**
```js
import { embedEntryAsync } from './lib/embedEntry.js'
```

- [ ] **Step 3: Update `handleAddEntry`** as shown above

- [ ] **Step 4: Update `handleNoteSave`** — add `embedEntryAsync(supabase, updated)` after `applyUpdateEntry`

- [ ] **Step 5: Update bulk handlers** — in `handleBulkImport`, `handleArchiveImport`, `handleSmartImport`, `handleMigrationImport` — add `created.forEach(e => embedEntryAsync(supabase, e))` (or `allCreated` where that's the variable name) after the existing `enrichEntries(created)` call

- [ ] **Step 6: Build and verify**
```
npm run build
```
Expected: exit 0, no errors

- [ ] **Step 7: Commit**
```
git add src/lib/embedEntry.js src/App.jsx
git commit -m "feat: auto-embed entries on save and bulk import"
```

---

## Task 2: iOS Shortcut setup guide in Settings

Add a "Mobile" tab to SettingsView with step-by-step instructions for setting up an iOS Shortcut that shares any webpage to MediaLog via the `capture` edge function.

**Files:**
- Modify: `src/components/SettingsView.jsx`

**What the iOS Shortcut does:**
The user creates a Shortcut in the iOS Shortcuts app with these actions:
1. Receive input from Share Sheet (Safari web pages → URL)
2. Get URL from input
3. Get Name from input (page title)  
4. Get Contents of URL: POST to `https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/capture`  
   - Method: POST  
   - Headers: `Content-Type: application/json`  
   - Body (JSON): `{"secret":"<CAPTURE_SECRET>","url":"[URL]","note":"[Name]"}`
5. Show alert "Saved to MediaLog ✓"

The tab should show:
- The capture endpoint URL (copyable): `https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/capture`
- Their CAPTURE_SECRET value from `import.meta.env.VITE_CAPTURE_SECRET` (same as bookmarklet — if not set, show a warning)
- Step-by-step numbered instructions (text only, no image uploads)
- A note: "In iOS Shortcuts: Receive input → Get URL → Get Name → Get Contents of URL (POST, JSON body below) → Show Result"
- The JSON body template they can copy:
  ```
  {"secret":"YOUR_SECRET","url":"[Shortcut Input]","note":"[Name of Shortcut Input]"}
  ```
  With the secret pre-filled if `VITE_CAPTURE_SECRET` is set

**TABS array change** — add after the existing 'bookmarklet' tab:
```js
{ id: 'mobile', label: 'iOS Shortcut' },
```

- [ ] **Step 1: Add 'iOS Shortcut' tab to TABS array** in SettingsView.jsx — insert `{ id: 'mobile', label: 'iOS Shortcut' }` after the bookmarklet tab entry

- [ ] **Step 2: Add the tab content JSX** — add `{tab === 'mobile' && (...)}` section after the bookmarklet tab section. Content:

```jsx
{tab === 'mobile' && (
  <section>
    <h2>iOS Shortcut</h2>
    <div className="card">
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Create an iOS Shortcut to share any Safari page directly to your MediaLog inbox.
        In the Shortcuts app, create a new shortcut with these actions:
      </p>
      <ol style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 20, marginBottom: 16 }}>
        <li>Receive input from <strong>Share Sheet</strong> (input type: URLs)</li>
        <li>Get URLs from <em>Shortcut Input</em></li>
        <li>Get Name of <em>Shortcut Input</em></li>
        <li>Get Contents of URL → Method: POST, Headers: <code>Content-Type: application/json</code>, Body: JSON (see below)</li>
        <li>Show Result (optional — confirms it saved)</li>
      </ol>
      <div className="form-group">
        <label>Capture Endpoint</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input readOnly value="https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/capture" style={{ fontFamily: 'monospace', fontSize: 12 }} />
          <button onClick={() => { navigator.clipboard.writeText('https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/capture'); addToast('Copied', 'success') }} style={{ flexShrink: 0 }}>Copy</button>
        </div>
      </div>
      {import.meta.env.VITE_CAPTURE_SECRET ? (
        <div className="form-group">
          <label>JSON Body (paste into "Request Body" field)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              readOnly
              rows={3}
              style={{ fontFamily: 'monospace', fontSize: 11, resize: 'none' }}
              value={`{"secret":"${import.meta.env.VITE_CAPTURE_SECRET}","url":"[URLs]","note":"[Name]"}`}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(`{"secret":"${import.meta.env.VITE_CAPTURE_SECRET}","url":"[URLs]","note":"[Name]"}`); addToast('Copied', 'success') }}
              style={{ flexShrink: 0, alignSelf: 'flex-start' }}
            >Copy</button>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>Replace <code>[URLs]</code> and <code>[Name]</code> with the Shortcuts variables of the same name.</p>
        </div>
      ) : (
        <p style={{ color: 'var(--warning, #b45309)', fontSize: 13 }}>
          Add <code>VITE_CAPTURE_SECRET</code> to your <code>.env.local</code> to see the pre-filled JSON body.
        </p>
      )}
    </div>
  </section>
)}
```

- [ ] **Step 3: Build and verify**
```
npm run build
```
Expected: exit 0

- [ ] **Step 4: Commit**
```
git add src/components/SettingsView.jsx
git commit -m "feat: add iOS Shortcut setup guide to Settings"
```

---

## Task 3: Prune stale git worktrees and branches

Remove orphaned worktrees from previous feature work.

**Files:** None (git operations only)

- [ ] **Step 1: Prune detached worktrees**
```
git worktree prune
```

- [ ] **Step 2: List remaining worktrees**
```
git worktree list
```
Expected: only the main worktree remains

- [ ] **Step 3: Check if orphan branches still exist**
```
git branch | grep -E "feat/ai-infra|feat/feed-widget|feat/opportunity-radar-backend"
```

- [ ] **Step 4: Delete any orphan branches that show up** (only if they exist and have no unmerged work)
```
git log master..feat/ai-infra --oneline  # verify nothing unmerged
git branch -D feat/ai-infra              # delete if safe
# repeat for others
```

- [ ] **Step 5: Update README** — remove the worktree prune item from the Tech Debt TODO section in `README.md`

- [ ] **Step 6: Commit**
```
git add README.md
git commit -m "chore: prune stale git worktrees and branches"
```
