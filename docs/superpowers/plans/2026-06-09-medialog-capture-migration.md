# MediaLog Plan 2 — Capture & Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make capture frictionless and migrate the existing backlog: auto-fetch link titles, bulk-paste import into Inbox, a Sort Inbox triage view, and an iOS Shortcut capture endpoint.

**Architecture:** Two Supabase Edge Functions (Deno) — `enrich` (GET: fetch a URL's title, called by the web app) and `capture` (POST: shared-secret endpoint the iOS Shortcut hits to insert an Inbox entry via the service-role key). Title-parsing logic is a pure function unit-tested with Vitest. The web app gains a bulk-import data-layer function and two new views (Bulk Import, Sort Inbox) reusing Plan 1's data layer.

**Tech Stack:** Existing (Vite/React/Vitest/Supabase) + Supabase Edge Functions (Deno/TypeScript), Supabase CLI for deploy.

**Scope note:** Plan 2 of 3. Tag management UI and the consumption-status/progress/markdown/Revisit/export features are Plan 3. Plan 2's Sort Inbox does topic-reassignment + delete (the core triage); tag-adding during triage lands in Plan 3 alongside the tag data layer, since tags also drive Plan 3's media-kind progress view.

**Source spec:** `docs/superpowers/specs/2026-06-07-medialog-design.md`

**Prerequisite:** Plan 1 merged. Supabase project live with `0001_init.sql` applied. Supabase CLI installed (`npm i -g supabase`) and logged in (`supabase login`) — used in Tasks 1 and 7 (user-run deploy steps).

---

## File Structure

```
supabase/functions/_shared/extractTitle.ts   — pure: parse <title>/og:title + site from HTML
supabase/functions/_shared/extractTitle.test.js — Vitest unit tests for extractTitle
supabase/functions/enrich/index.ts            — Deno handler: GET ?url= -> { title, site }
supabase/functions/capture/index.ts           — Deno handler: POST {url,note,secret} -> insert Inbox entry
src/lib/enrich.js                             — client wrapper: invoke 'enrich' edge function
src/lib/enrich.test.js                        — tests for the wrapper (mocked supabase.functions)
src/lib/db/entries.js                         — MODIFY: add bulkCreateEntries, listEntriesByTopic already exists
src/lib/db/entries.test.js                    — MODIFY: add bulkCreateEntries tests
src/lib/db/topics.js                          — MODIFY: add getTopicByName (to resolve Inbox id)
src/lib/db/topics.test.js                     — MODIFY: add getTopicByName tests
src/lib/parseBulk.js                          — pure: split textarea into {url|null, note} items
src/lib/parseBulk.test.js                     — tests for parseBulk
src/components/BulkImport.jsx                 — textarea -> bulkCreateEntries into Inbox
src/components/BulkImport.test.jsx            — tests
src/components/SortInbox.jsx                  — triage Inbox entries one at a time (reassign topic / delete)
src/components/SortInbox.test.jsx             — tests
src/App.jsx                                   — MODIFY: add simple view switcher (Browse / Bulk Import / Sort Inbox)
docs/ios-shortcut-setup.md                    — manual setup guide for the iOS Shortcut
```

---

## Task 1: `enrich` Edge Function — title extraction (pure logic, TDD)

**Files:**
- Create: `supabase/functions/_shared/extractTitle.ts`, `supabase/functions/_shared/extractTitle.test.js`

The HTML-parsing logic is pure and Deno-free so Vitest can test it. The Deno handler (next task) imports it.

- [ ] **Step 1: Write failing test `supabase/functions/_shared/extractTitle.test.js`**

```js
import { describe, test, expect } from 'vitest'
import { extractTitle } from './extractTitle.ts'

describe('extractTitle', () => {
  test('prefers og:title when present', () => {
    const html = '<html><head><meta property="og:title" content="OG Name"><title>Plain</title></head></html>'
    expect(extractTitle(html, 'https://example.com/x')).toEqual({ title: 'OG Name', site: 'example.com' })
  })

  test('falls back to <title>', () => {
    const html = '<html><head><title>Just Title</title></head></html>'
    expect(extractTitle(html, 'https://news.ycombinator.com/item?id=1')).toEqual({
      title: 'Just Title', site: 'news.ycombinator.com',
    })
  })

  test('trims and collapses whitespace in titles', () => {
    const html = '<title>\n  Spaced   Out \n</title>'
    expect(extractTitle(html, 'https://a.com').title).toBe('Spaced Out')
  })

  test('returns null title when none found', () => {
    expect(extractTitle('<html></html>', 'https://a.com')).toEqual({ title: null, site: 'a.com' })
  })

  test('decodes common HTML entities', () => {
    const html = '<title>Tom &amp; Jerry &lt;3</title>'
    expect(extractTitle(html, 'https://a.com').title).toBe('Tom & Jerry <3')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- extractTitle`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `supabase/functions/_shared/extractTitle.ts`**

```ts
// Pure HTML title extraction. No Deno/Node APIs so it is unit-testable with Vitest.
export function extractTitle(html: string, url: string): { title: string | null; site: string } {
  let site = ''
  try {
    site = new URL(url).hostname
  } catch {
    site = ''
  }

  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const raw = (og && og[1]) || (titleTag && titleTag[1]) || null

  return { title: raw ? clean(raw) : null, site }
}

function clean(s: string): string {
  return decodeEntities(s).replace(/\s+/g, ' ').trim()
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- extractTitle`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/extractTitle.ts supabase/functions/_shared/extractTitle.test.js
git commit -m "feat: add pure title-extraction logic for enrich function"
```

---

## Task 2: `enrich` Edge Function — Deno handler (manual deploy)

**Files:**
- Create: `supabase/functions/enrich/index.ts`

This wraps `extractTitle` in a Deno HTTP handler with CORS so the browser can call it. It has no Vitest coverage (runs on Deno); verification is the manual curl in Step 4.

- [ ] **Step 1: Implement `supabase/functions/enrich/index.ts`**

```ts
import { extractTitle } from '../_shared/extractTitle.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url).searchParams.get('url')
  if (!url) {
    return new Response(JSON.stringify({ error: 'missing url' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MediaLogBot/1.0' }, redirect: 'follow' })
    const html = await res.text()
    const result = extractTitle(html, url)
    return new Response(JSON.stringify(result), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (_e) {
    // Never block a save on enrichment: return null title, keep the site.
    let site = ''
    try { site = new URL(url).hostname } catch { /* ignore */ }
    return new Response(JSON.stringify({ title: null, site }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/enrich/index.ts
git commit -m "feat: add enrich edge function handler"
```

- [ ] **Step 3: Deploy (USER step)**

Run (requires `supabase login` + project linked via `supabase link --project-ref <ref>`):
```bash
supabase functions deploy enrich --no-verify-jwt
```
`--no-verify-jwt` lets the browser call it without a session token (it only reads public web pages; no data access). Expected: "Deployed Function enrich".

- [ ] **Step 4: Verify (USER step)**

```bash
curl "https://<project-ref>.functions.supabase.co/enrich?url=https://news.ycombinator.com"
```
Expected: JSON like `{"title":"Hacker News","site":"news.ycombinator.com"}`.

---

## Task 3: enrich client wrapper (TDD)

**Files:**
- Create: `src/lib/enrich.js`, `src/lib/enrich.test.js`

- [ ] **Step 1: Write failing test `src/lib/enrich.test.js`**

```js
import { describe, test, expect, vi } from 'vitest'
import { fetchTitle } from './enrich.js'

function mockClient(response) {
  return { functions: { invoke: vi.fn(() => Promise.resolve(response)) } }
}

describe('fetchTitle', () => {
  test('returns title from the enrich function', async () => {
    const client = mockClient({ data: { title: 'A Site', site: 'a.com' }, error: null })
    const result = await fetchTitle(client, 'https://a.com')
    expect(client.functions.invoke).toHaveBeenCalledWith('enrich', { body: { url: 'https://a.com' } })
    expect(result).toBe('A Site')
  })

  test('returns null when the function errors (never throws)', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    const result = await fetchTitle(client, 'https://a.com')
    expect(result).toBeNull()
  })

  test('returns null when data has no title', async () => {
    const client = mockClient({ data: { title: null, site: 'a.com' }, error: null })
    expect(await fetchTitle(client, 'https://a.com')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- enrich`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/enrich.js`**

```js
// Calls the `enrich` edge function. Never throws — enrichment is best-effort,
// a failed title must not block saving an entry.
export async function fetchTitle(supabase, url) {
  try {
    const { data, error } = await supabase.functions.invoke('enrich', { body: { url } })
    if (error || !data) return null
    return data.title ?? null
  } catch {
    return null
  }
}
```

Note: the Deno handler reads `url` from the query string, but `supabase.functions.invoke` sends a JSON body. Update the handler to also accept a JSON body. Apply this edit to `supabase/functions/enrich/index.ts` — replace the url-reading line:

```ts
  let url: string | null = new URL(req.url).searchParams.get('url')
  if (!url && req.method === 'POST') {
    try { url = (await req.json())?.url ?? null } catch { url = null }
  }
```

and add `'POST'` to `Access-Control-Allow-Methods`. Re-deploy in Task 2 Step 3 covers this (note for the user: redeploy `enrich` after this change).

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- enrich`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrich.js src/lib/enrich.test.js supabase/functions/enrich/index.ts
git commit -m "feat: add enrich client wrapper, accept POST body in edge function"
```

---

## Task 4: Auto-fill title on quick-add

**Files:**
- Modify: `src/App.jsx` (the `handleAddEntry` function)

Wire enrichment into the existing quick-add flow: after creating an entry with a URL, fetch its title and patch the entry.

- [ ] **Step 1: Update `handleAddEntry` in `src/App.jsx`**

Find the existing function:
```jsx
  async function handleAddEntry({ url, note }) {
    const e = await createEntry(supabase, { topicId: selectedId, url, note })
    setEntries((prev) => [e, ...prev])
  }
```

Replace with (adds best-effort enrichment; import `fetchTitle` and `updateEntry` at top of file):
```jsx
  async function handleAddEntry({ url, note }) {
    const e = await createEntry(supabase, { topicId: selectedId, url, note })
    setEntries((prev) => [e, ...prev])
    if (url) {
      const title = await fetchTitle(supabase, url)
      if (title) {
        const updated = await updateEntry(supabase, e.id, { title })
        setEntries((prev) => prev.map((x) => (x.id === e.id ? updated : x)))
      }
    }
  }
```

Add to the imports at the top of `src/App.jsx`:
```jsx
import { fetchTitle } from './lib/enrich.js'
```
and ensure `updateEntry` is included in the existing import from `./lib/db/entries.js` (change the import line to):
```jsx
import {
  listEntriesByTopic, createEntry, updateEntry, deleteEntry, searchEntries,
} from './lib/db/entries.js'
```

- [ ] **Step 2: Update `src/App.test.jsx` mock so the new imports resolve**

The App test mocks `./lib/supabaseClient.js`; add a mock for `./lib/enrich.js` so the import is inert in the logged-out smoke test. Add near the other `vi.mock` calls:
```jsx
vi.mock('./lib/enrich.js', () => ({ fetchTitle: vi.fn(() => Promise.resolve(null)) }))
```

- [ ] **Step 3: Run full suite**

Run: `npm test`
Expected: PASS (all suites; App smoke test still green).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: auto-fetch link title on quick-add"
```

---

## Task 5: Bulk import (parse + data layer + view, TDD)

**Files:**
- Create: `src/lib/parseBulk.js`, `src/lib/parseBulk.test.js`
- Modify: `src/lib/db/entries.js`, `src/lib/db/entries.test.js`
- Modify: `src/lib/db/topics.js`, `src/lib/db/topics.test.js`
- Create: `src/components/BulkImport.jsx`, `src/components/BulkImport.test.jsx`

- [ ] **Step 1: Write failing test `src/lib/parseBulk.test.js`**

```js
import { describe, test, expect } from 'vitest'
import { parseBulk } from './parseBulk.js'

describe('parseBulk', () => {
  test('splits lines into items, detecting urls', () => {
    const input = 'https://a.com\nsome plain idea\n  https://b.com/x  '
    expect(parseBulk(input)).toEqual([
      { url: 'https://a.com', note: '' },
      { url: null, note: 'some plain idea' },
      { url: 'https://b.com/x', note: '' },
    ])
  })

  test('ignores blank lines', () => {
    expect(parseBulk('https://a.com\n\n\n')).toEqual([{ url: 'https://a.com', note: '' }])
  })

  test('returns empty array for empty input', () => {
    expect(parseBulk('   ')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- parseBulk`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/parseBulk.js`**

```js
// Splits a textarea blob into entry items, one per non-blank line.
// A line that parses as an http(s) URL becomes { url, note: '' };
// anything else becomes a plain note { url: null, note }.
export function parseBulk(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => (isUrl(line) ? { url: line, note: '' } : { url: null, note: line }))
}

function isUrl(s) {
  if (/\s/.test(s)) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- parseBulk`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `getTopicByName` test to `src/lib/db/topics.test.js`**

Append inside the existing `describe('topics db', ...)` block:
```js
  test('getTopicByName returns the matching topic', async () => {
    const row = { id: 'inbox-id', name: 'Inbox' }
    const client = mockClient({ data: row, error: null })
    const result = await getTopicByName(client, 'Inbox')
    expect(client._chain.eq).toHaveBeenCalledWith('name', 'Inbox')
    expect(result).toEqual(row)
  })
```
Update the import at the top of the file to include `getTopicByName` and add `eq` to the mock chain. Replace the `mockClient` in `topics.test.js` with this version (adds `eq`):
```js
function mockClient(result) {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}
```
and change the import line to:
```js
import { listTopics, createTopic, getTopicByName } from './topics.js'
```

- [ ] **Step 6: Run test, verify the new topics test fails**

Run: `npm test -- topics`
Expected: FAIL — `getTopicByName` not defined.

- [ ] **Step 7: Add `getTopicByName` to `src/lib/db/topics.js`**

```js
export async function getTopicByName(supabase, name) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('name', name)
    .single()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 8: Run test, verify it passes**

Run: `npm test -- topics`
Expected: PASS (4 tests).

- [ ] **Step 9: Add `bulkCreateEntries` test to `src/lib/db/entries.test.js`**

Append inside the existing `describe('entries db', ...)`:
```js
  test('bulkCreateEntries inserts all items under a topic', async () => {
    const rows = [{ id: '1' }, { id: '2' }]
    const client = mockClient({ data: rows, error: null })
    const items = [{ url: 'http://a', note: '' }, { url: null, note: 'idea' }]
    const result = await bulkCreateEntries(client, 'inbox-id', items)
    expect(client._chain.insert).toHaveBeenCalledWith([
      { topic_id: 'inbox-id', url: 'http://a', note: '' },
      { topic_id: 'inbox-id', url: null, note: 'idea' },
    ])
    expect(result).toEqual(rows)
  })
```
Update the import line in `entries.test.js` to add `bulkCreateEntries`. The existing `mockClient` already has `insert` and `select`; add a `select` terminal that resolves. The current mock's `select` returns `chain` and `order`/`single` are terminals. For bulk insert we end with `.select()` (no `.single()`), so make `select` resolvable when awaited. Replace the mock's `select` line with:
```js
    select: vi.fn(() => Object.assign(Promise.resolve(result), chain)),
```
This lets `.select()` be both awaitable and chainable.

- [ ] **Step 10: Run test, verify it fails**

Run: `npm test -- entries`
Expected: FAIL — `bulkCreateEntries` not defined.

- [ ] **Step 11: Add `bulkCreateEntries` to `src/lib/db/entries.js`**

```js
export async function bulkCreateEntries(supabase, topicId, items) {
  const rows = items.map((it) => ({ topic_id: topicId, url: it.url ?? null, note: it.note ?? '' }))
  const { data, error } = await supabase.from('entries').insert(rows).select()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 12: Run test, verify it passes**

Run: `npm test -- entries`
Expected: PASS (6 tests).

- [ ] **Step 13: Write `src/components/BulkImport.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import BulkImport from './BulkImport.jsx'

test('parses textarea and calls onImport with item count', async () => {
  const onImport = vi.fn(() => Promise.resolve(2))
  render(<BulkImport onImport={onImport} />)
  await userEvent.type(screen.getByPlaceholderText(/paste/i), 'https://a.com\nan idea')
  await userEvent.click(screen.getByRole('button', { name: /import/i }))
  expect(onImport).toHaveBeenCalledWith([
    { url: 'https://a.com', note: '' },
    { url: null, note: 'an idea' },
  ])
})

test('does nothing on empty input', async () => {
  const onImport = vi.fn()
  render(<BulkImport onImport={onImport} />)
  await userEvent.click(screen.getByRole('button', { name: /import/i }))
  expect(onImport).not.toHaveBeenCalled()
})
```

- [ ] **Step 14: Run test, verify it fails**

Run: `npm test -- BulkImport`
Expected: FAIL.

- [ ] **Step 15: Implement `src/components/BulkImport.jsx`**

```jsx
import { useState } from 'react'
import { parseBulk } from '../lib/parseBulk.js'

export default function BulkImport({ onImport }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState(null)

  async function handleImport() {
    const items = parseBulk(text)
    if (items.length === 0) return
    setStatus('Importing…')
    const count = await onImport(items)
    setStatus(`Imported ${count} into Inbox.`)
    setText('')
  }

  return (
    <div>
      <textarea
        placeholder="Paste links or notes, one per line"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        style={{ width: '100%' }}
      />
      <button onClick={handleImport}>Import to Inbox</button>
      {status && <p>{status}</p>}
    </div>
  )
}
```

- [ ] **Step 16: Run test, verify it passes**

Run: `npm test -- BulkImport`
Expected: PASS (2 tests).

- [ ] **Step 17: Commit**

```bash
git add src/lib/parseBulk.js src/lib/parseBulk.test.js src/lib/db/topics.js src/lib/db/topics.test.js src/lib/db/entries.js src/lib/db/entries.test.js src/components/BulkImport.jsx src/components/BulkImport.test.jsx
git commit -m "feat: add bulk-paste import to Inbox"
```

---

## Task 6: Sort Inbox triage view (TDD)

**Files:**
- Create: `src/components/SortInbox.jsx`, `src/components/SortInbox.test.jsx`

Presents Inbox entries one at a time. For the current entry: pick a destination topic (reassign) or delete. Reassigning a non-Inbox topic removes it from the queue.

- [ ] **Step 1: Write `src/components/SortInbox.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import SortInbox from './SortInbox.jsx'

const topics = [
  { id: 'inbox', name: 'Inbox' },
  { id: 'ai', name: 'AI' },
  { id: 'film', name: 'Film' },
]
const inboxEntries = [
  { id: 'e1', url: 'http://a.com', title: 'A', note: '' },
  { id: 'e2', url: null, title: null, note: 'idea two' },
]

test('shows the first inbox entry and a topic selector excluding Inbox', () => {
  render(<SortInbox entries={inboxEntries} topics={topics} onAssign={() => {}} onDelete={() => {}} />)
  expect(screen.getByText('A')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'AI' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Inbox' })).not.toBeInTheDocument()
})

test('assigns the current entry to the chosen topic', async () => {
  const onAssign = vi.fn(() => Promise.resolve())
  render(<SortInbox entries={inboxEntries} topics={topics} onAssign={onAssign} onDelete={() => {}} />)
  await userEvent.selectOptions(screen.getByRole('combobox'), 'ai')
  await userEvent.click(screen.getByRole('button', { name: /assign/i }))
  expect(onAssign).toHaveBeenCalledWith('e1', 'ai')
})

test('deletes the current entry', async () => {
  const onDelete = vi.fn(() => Promise.resolve())
  render(<SortInbox entries={inboxEntries} topics={topics} onAssign={() => {}} onDelete={onDelete} />)
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('e1')
})

test('shows done message when no entries', () => {
  render(<SortInbox entries={[]} topics={topics} onAssign={() => {}} onDelete={() => {}} />)
  expect(screen.getByText(/inbox is clear/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- SortInbox`
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/SortInbox.jsx`**

```jsx
import { useState } from 'react'

export default function SortInbox({ entries, topics, onAssign, onDelete }) {
  const [index, setIndex] = useState(0)
  const [target, setTarget] = useState('')

  const current = entries[index]
  const destinations = topics.filter((t) => t.name !== 'Inbox')

  if (!current) return <p>Inbox is clear. 🎉</p>

  async function handleAssign() {
    if (!target) return
    await onAssign(current.id, target)
    setTarget('')
    setIndex((i) => i + 1)
  }

  async function handleDelete() {
    await onDelete(current.id)
    setIndex((i) => i + 1)
  }

  return (
    <div>
      <p>{entries.length - index} left in Inbox</p>
      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
        {current.url && <a href={current.url} target="_blank" rel="noreferrer">{current.title || current.url}</a>}
        {current.note && <p style={{ whiteSpace: 'pre-wrap' }}>{current.note}</p>}
      </div>
      <select value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Choose topic…</option>
        {destinations.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <button onClick={handleAssign}>Assign</button>
      <button onClick={handleDelete} aria-label="delete">Delete</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- SortInbox`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SortInbox.jsx src/components/SortInbox.test.jsx
git commit -m "feat: add Sort Inbox triage view"
```

---

## Task 7: Wire Bulk Import + Sort Inbox into App

**Files:**
- Modify: `src/App.jsx`

Add a minimal view switcher (plain buttons — styling comes in the final design pass) between Browse, Bulk Import, and Sort Inbox. Both new views operate on the Inbox topic resolved by name.

- [ ] **Step 1: Update `src/App.jsx`**

Add imports:
```jsx
import { getTopicByName } from './lib/db/topics.js'
import { bulkCreateEntries } from './lib/db/entries.js'
import BulkImport from './components/BulkImport.jsx'
import SortInbox from './components/SortInbox.jsx'
```

Inside `Workspace`, add view + inbox state and handlers (place after the existing `useState` hooks):
```jsx
  const [view, setView] = useState('browse') // 'browse' | 'bulk' | 'sort'
  const [inboxEntries, setInboxEntries] = useState([])

  const inboxTopic = topics.find((t) => t.name === 'Inbox')

  async function loadInbox() {
    if (inboxTopic) setInboxEntries(await listEntriesByTopic(supabase, inboxTopic.id))
  }

  async function handleBulkImport(items) {
    const inbox = inboxTopic || (await getTopicByName(supabase, 'Inbox'))
    const created = await bulkCreateEntries(supabase, inbox.id, items)
    return created.length
  }

  async function handleAssign(entryId, topicId) {
    await updateEntry(supabase, entryId, { topic_id: topicId })
    setInboxEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function handleSortDelete(entryId) {
    await deleteEntry(supabase, entryId)
    setInboxEntries((prev) => prev.filter((e) => e.id !== entryId))
  }
```

Add the view-switch links to the existing **sidebar** (`<aside>`), above the `<TopicList>` (per the deliberate sidebar-navigation choice). Insert after the "Sign out" button:
```jsx
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: 16 }}>
          <li><button onClick={() => setView('browse')}>Browse</button></li>
          <li><button onClick={() => setView('bulk')}>Bulk Import</button></li>
          <li><button onClick={() => { setView('sort'); loadInbox() }}>Sort Inbox</button></li>
        </ul>
```
The topic list stays below these nav links in the sidebar (topics are the pillar; the nav sits above them).

Then wrap the existing search/quick-add/entry-list block so it only shows in browse view, and render the other views:
```jsx
        {view === 'browse' && (
          <>
            <SearchBar value={query} onChange={setQuery} />
            {!query && selectedId && <QuickAdd onAdd={handleAddEntry} disabled={!selectedId} />}
            <EntryList entries={entries} onDelete={handleDelete} />
          </>
        )}
        {view === 'bulk' && <BulkImport onImport={handleBulkImport} />}
        {view === 'sort' && (
          <SortInbox
            entries={inboxEntries}
            topics={topics}
            onAssign={handleAssign}
            onDelete={handleSortDelete}
          />
        )}
```

- [ ] **Step 2: Run full suite**

Run: `npm test`
Expected: PASS (all suites; App smoke test unaffected — it only checks the logged-out view).

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire bulk import and sort inbox views"
```

---

## Task 8: `capture` Edge Function for iOS Shortcut (manual deploy)

**Files:**
- Create: `supabase/functions/capture/index.ts`

A POST endpoint the iOS Shortcut hits with a shared secret. It inserts an Inbox entry using the service-role key for the single known user. No Vitest coverage (Deno + privileged); verified by the manual curl in Step 4.

- [ ] **Step 1: Implement `supabase/functions/capture/index.ts`**

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  const body = await req.json().catch(() => ({}))
  if (body.secret !== Deno.env.get('CAPTURE_SECRET')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const userId = Deno.env.get('CAPTURE_USER_ID')!

  // Find the user's Inbox topic.
  const { data: inbox } = await supabase
    .from('topics').select('id').eq('user_id', userId).eq('name', 'Inbox').single()
  if (!inbox) {
    return new Response(JSON.stringify({ error: 'no inbox' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { error } = await supabase.from('entries').insert({
    user_id: userId,
    topic_id: inbox.id,
    url: body.url ?? null,
    note: body.note ?? '',
  })
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/capture/index.ts
git commit -m "feat: add capture edge function for iOS shortcut"
```

- [ ] **Step 3: Set secrets + deploy (USER step)**

First find your user id: Supabase dashboard → Authentication → Users → copy your UID. Generate a random secret (e.g. run `openssl rand -hex 16`). Then:
```bash
supabase secrets set CAPTURE_SECRET=<your-random-secret>
supabase secrets set CAPTURE_USER_ID=<your-user-uid>
supabase functions deploy capture --no-verify-jwt
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically. Expected: "Deployed Function capture".

- [ ] **Step 4: Verify (USER step)**

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/capture" \
  -H "Content-Type: application/json" \
  -d '{"secret":"<your-secret>","url":"https://example.com","note":"from curl"}'
```
Expected: `{"ok":true}`. Confirm a new Inbox entry appears in the app / Table Editor.

---

## Task 9: iOS Shortcut setup guide

**Files:**
- Create: `docs/ios-shortcut-setup.md`

- [ ] **Step 1: Create `docs/ios-shortcut-setup.md`**

```markdown
# iOS Shortcut — "Add to MediaLog"

Captures the current Safari page (or any shared URL/text) into your MediaLog Inbox.

## Build the Shortcut
1. Open the **Shortcuts** app → **+** → name it "Add to MediaLog".
2. Turn on **Show in Share Sheet** (settings icon at top). Under "Accept", allow **URLs** and **Text**.
3. Add action **Get Contents of URL**:
   - URL: `https://<project-ref>.functions.supabase.co/capture`
   - Method: **POST**
   - Headers: add `Content-Type` = `application/json`
   - Request Body: **JSON**, with fields:
     - `secret` (Text) = your `CAPTURE_SECRET`
     - `url` (Text) = the **Shortcut Input** (Magic Variable)
     - `note` (Text) = leave blank or add an "Ask Each Time" text prompt
4. (Optional) Add **Show Notification** with the response so you get confirmation.

## Use it
In any app → Share → **Add to MediaLog**. The link lands in your Inbox; triage it later via **Sort Inbox**.

## Security note
The `secret` is stored inside the Shortcut on your device. If it leaks, rotate it:
`supabase secrets set CAPTURE_SECRET=<new>` and update the Shortcut.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ios-shortcut-setup.md
git commit -m "docs: add iOS shortcut setup guide"
```

---

## Done criteria for Plan 2

- `npm test` passes all suites (new: extractTitle, enrich, parseBulk, BulkImport, SortInbox, plus topics/entries additions).
- `npm run build` succeeds.
- USER-verified: `enrich` returns titles; quick-add auto-fills titles; bulk paste dumps many entries into Inbox; Sort Inbox reassigns/deletes; `capture` + iOS Shortcut inserts an Inbox entry from the share sheet.
- Ready for Plan 3 (status/progress, markdown, tags UI, Revisit feed, export).
```
