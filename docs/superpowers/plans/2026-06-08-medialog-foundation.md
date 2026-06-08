# MediaLog Plan 1 — Foundation & Buckets

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working, installable PWA where the user logs in (magic link), creates flat topics, and captures/searches entries (link + note) synced to Supabase.

**Architecture:** Pure client-side React SPA (Vite) talking directly to Supabase (Postgres + Auth) via the JS client. Data access lives in pure functions (`src/lib/db/*`) that take the supabase client as their first argument, so they unit-test against a mock with no network. UI components consume those functions. Row Level Security ties every row to the authenticated user via a `user_id` column defaulting to `auth.uid()`.

**Tech Stack:** Vite, React 18, `@supabase/supabase-js` v2, `vite-plugin-pwa`, Vitest + @testing-library/react + jsdom.

**Scope note:** This is Plan 1 of 3. Plan 2 adds the link-title Edge Function, bulk import, Sort Inbox, and the iOS Shortcut. Plan 3 adds consumption status/progress, markdown rendering, the Revisit feed, and export. Plan 1 ends as a usable app on its own.

**Source spec:** `docs/superpowers/specs/2026-06-07-medialog-design.md`

---

## File Structure

```
medialog/
  package.json                  — deps + scripts
  vite.config.js                — Vite + VitePWA + Vitest config
  index.html                    — SPA entry
  .gitignore                    — ignore node_modules, .env.local, dist
  .env.example                  — documents required VITE_ vars
  src/test/setup.js             — jsdom + testing-library matchers
  src/main.jsx                  — React root render
  src/App.jsx                   — top-level layout, wires AuthGate + topic/entry views
  src/lib/supabaseClient.js     — createClient from env
  src/lib/db/topics.js          — listTopics, createTopic (pure, take client)
  src/lib/db/entries.js         — listEntriesByTopic, createEntry, updateEntry, deleteEntry, searchEntries
  src/hooks/useSession.js       — subscribes to Supabase auth session
  src/components/AuthGate.jsx   — magic-link login; renders children when authed
  src/components/TopicList.jsx  — list topics, select one, add new
  src/components/EntryCard.jsx  — render a single entry (title/link + note), delete
  src/components/EntryList.jsx  — entries for the selected topic
  src/components/QuickAdd.jsx   — + form: url + note → createEntry
  src/components/SearchBar.jsx  — text search across entries
  supabase/migrations/0001_init.sql — schema + RLS + Inbox seed (applied manually)
  README.md                     — setup + deploy instructions
```

Tests live next to code as `*.test.js` / `*.test.jsx`.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `index.html`, `.gitignore`, `.env.example`, `src/main.jsx`, `src/App.jsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "medialog",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules
dist
.env.local
.DS_Store
```

- [ ] **Step 3: Create `.env.example`**

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#111111" />
    <title>MediaLog</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Create placeholder `src/App.jsx`**

```jsx
export default function App() {
  return <h1>MediaLog</h1>
}
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: completes, creates `node_modules` and `package-lock.json`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json index.html .gitignore .env.example src/main.jsx src/App.jsx
git commit -m "chore: scaffold vite react project"
```

---

## Task 2: Vite + PWA + Vitest config

**Files:**
- Create: `vite.config.js`, `src/test/setup.js`

- [ ] **Step 1: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MediaLog',
        short_name: 'MediaLog',
        description: 'A media log for links, notes, and takeaways by topic.',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
```

- [ ] **Step 2: Create `src/test/setup.js`**

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Add a smoke test `src/App.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

test('renders the app heading', () => {
  render(<App />)
  expect(screen.getByText('MediaLog')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 5: Generate PWA icons**

Create two solid placeholder PNG icons so the manifest is valid. Run:

```bash
node -e "const z=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');require('fs').writeFileSync('public/pwa-192x192.png',z);require('fs').writeFileSync('public/pwa-512x512.png',z)"
```

Note: these are 1x1 placeholders that satisfy the build. Replace with real 192/512 icons before production (use `nano-banana` or any icon generator).

- [ ] **Step 6: Verify build succeeds**

Run: `npm run build`
Expected: build completes, `dist/` produced with `manifest.webmanifest` and a service worker.

- [ ] **Step 7: Commit**

```bash
git add vite.config.js src/test/setup.js src/App.test.jsx public/pwa-192x192.png public/pwa-512x512.png
git commit -m "chore: add vite-plugin-pwa and vitest config"
```

---

## Task 3: Database schema + RLS migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

This migration is applied manually in the Supabase dashboard SQL editor (no local Supabase CLI required for Plan 1). It implements the spec's data model plus a `user_id` column on each table to enforce the "RLS scoped to the one user" requirement.

- [ ] **Step 1: Create `supabase/migrations/0001_init.sql`**

```sql
-- Topics: flat, no nesting.
create table topics (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Entries: one topic, optional url + auto-fetched title, markdown note.
create table entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic_id         uuid not null references topics(id) on delete cascade,
  url              text,
  title            text,
  note             text not null default '',
  status           text check (status in ('backlog','active','done')),
  created_at       timestamptz not null default now(),
  last_surfaced_at timestamptz
);

-- Tags + join (also used for media-kind like #book, #video).
create table tags (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name    text not null,
  unique (user_id, name)
);

create table entry_tags (
  entry_id uuid not null references entries(id) on delete cascade,
  tag_id   uuid not null references tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);

-- Row Level Security: every row belongs to its creator.
alter table topics enable row level security;
alter table entries enable row level security;
alter table tags enable row level security;
alter table entry_tags enable row level security;

create policy "own topics" on topics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own entries" on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tags" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own entry_tags" on entry_tags
  for all using (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  );

-- Seed the Inbox topic for each new user via trigger.
create function seed_inbox() returns trigger as $$
begin
  insert into topics (user_id, name) values (new.id, 'Inbox');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function seed_inbox();
```

- [ ] **Step 2: Apply the migration**

In the Supabase dashboard → SQL Editor → paste the file contents → Run.
Expected: "Success. No rows returned." Verify the four tables appear under Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add database schema, RLS, and Inbox seed migration"
```

---

## Task 4: Supabase client + session hook

**Files:**
- Create: `src/lib/supabaseClient.js`, `src/hooks/useSession.js`

- [ ] **Step 1: Create `src/lib/supabaseClient.js`**

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

- [ ] **Step 2: Create `src/hooks/useSession.js`**

```js
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

// Returns { session, loading }. session is null when logged out.
export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, loading }
}
```

- [ ] **Step 3: Create `.env.local`** (not committed — values from your Supabase project Settings → API)

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 4: Commit** (no test yet — covered when wired into AuthGate)

```bash
git add src/lib/supabaseClient.js src/hooks/useSession.js
git commit -m "feat: add supabase client and session hook"
```

---

## Task 5: Topics data layer (TDD)

**Files:**
- Create: `src/lib/db/topics.js`, `src/lib/db/topics.test.js`

These are pure functions taking the supabase client, so tests pass a chainable mock.

- [ ] **Step 1: Write the failing test `src/lib/db/topics.test.js`**

```js
import { describe, test, expect, vi } from 'vitest'
import { listTopics, createTopic } from './topics.js'

// Minimal chainable Supabase mock: each method returns `this`,
// and the chain resolves to { data, error } when awaited via the terminal call.
function mockClient(result) {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}

describe('topics db', () => {
  test('listTopics returns rows ordered by name', async () => {
    const rows = [{ id: '1', name: 'AI' }, { id: '2', name: 'Film' }]
    const client = mockClient({ data: rows, error: null })
    const result = await listTopics(client)
    expect(client.from).toHaveBeenCalledWith('topics')
    expect(result).toEqual(rows)
  })

  test('createTopic inserts and returns the new row', async () => {
    const row = { id: '3', name: 'Fitness' }
    const client = mockClient({ data: row, error: null })
    const result = await createTopic(client, 'Fitness')
    expect(client._chain.insert).toHaveBeenCalledWith({ name: 'Fitness' })
    expect(result).toEqual(row)
  })

  test('listTopics throws on error', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(listTopics(client)).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- topics`
Expected: FAIL — `listTopics`/`createTopic` not defined.

- [ ] **Step 3: Implement `src/lib/db/topics.js`**

```js
export async function listTopics(supabase) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

export async function createTopic(supabase, name) {
  const { data, error } = await supabase
    .from('topics')
    .insert({ name })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- topics`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/topics.js src/lib/db/topics.test.js
git commit -m "feat: add topics data layer"
```

---

## Task 6: Entries data layer (TDD)

**Files:**
- Create: `src/lib/db/entries.js`, `src/lib/db/entries.test.js`

- [ ] **Step 1: Write the failing test `src/lib/db/entries.test.js`**

```js
import { describe, test, expect, vi } from 'vitest'
import {
  listEntriesByTopic,
  createEntry,
  updateEntry,
  deleteEntry,
  searchEntries,
} from './entries.js'

// Chainable mock. Terminal resolvers: order() and single() resolve to `result`;
// eq() returns the chain so it can be followed by order/select/single.
function mockClient(result) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  }
  return { from: vi.fn(() => chain), _chain: chain }
}

describe('entries db', () => {
  test('listEntriesByTopic filters by topic, newest first', async () => {
    const rows = [{ id: 'a', note: 'hi' }]
    const client = mockClient({ data: rows, error: null })
    const result = await listEntriesByTopic(client, 'topic-1')
    expect(client.from).toHaveBeenCalledWith('entries')
    expect(client._chain.eq).toHaveBeenCalledWith('topic_id', 'topic-1')
    expect(client._chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(rows)
  })

  test('createEntry inserts provided fields', async () => {
    const row = { id: 'b', topic_id: 't', url: 'http://x', note: 'n' }
    const client = mockClient({ data: row, error: null })
    const result = await createEntry(client, { topicId: 't', url: 'http://x', note: 'n' })
    expect(client._chain.insert).toHaveBeenCalledWith({
      topic_id: 't', url: 'http://x', title: null, note: 'n',
    })
    expect(result).toEqual(row)
  })

  test('updateEntry applies a partial patch by id', async () => {
    const row = { id: 'b', note: 'edited' }
    const client = mockClient({ data: row, error: null })
    const result = await updateEntry(client, 'b', { note: 'edited' })
    expect(client._chain.update).toHaveBeenCalledWith({ note: 'edited' })
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'b')
    expect(result).toEqual(row)
  })

  test('deleteEntry removes by id', async () => {
    const client = mockClient({ data: null, error: null })
    await deleteEntry(client, 'b')
    expect(client._chain.delete).toHaveBeenCalled()
    expect(client._chain.eq).toHaveBeenCalledWith('id', 'b')
  })

  test('searchEntries matches note or title', async () => {
    const rows = [{ id: 'a', note: 'react' }]
    const client = mockClient({ data: rows, error: null })
    const result = await searchEntries(client, 'react')
    expect(client._chain.or).toHaveBeenCalledWith('note.ilike.%react%,title.ilike.%react%')
    expect(result).toEqual(rows)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- entries`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement `src/lib/db/entries.js`**

```js
export async function listEntriesByTopic(supabase, topicId) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function createEntry(supabase, { topicId, url = null, title = null, note = '' }) {
  const { data, error } = await supabase
    .from('entries')
    .insert({ topic_id: topicId, url, title, note })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateEntry(supabase, id, patch) {
  const { data, error } = await supabase
    .from('entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteEntry(supabase, id) {
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function searchEntries(supabase, query) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .or(`note.ilike.%${query}%,title.ilike.%${query}%`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
```

Note: `createEntry`'s test asserts `insert` is called with `title: null` — the implementation's default `title = null` produces this. Keep them in sync.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- entries`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/entries.js src/lib/db/entries.test.js
git commit -m "feat: add entries data layer"
```

---

## Task 7: AuthGate (magic-link login)

**Files:**
- Create: `src/components/AuthGate.jsx`, `src/components/AuthGate.test.jsx`

- [ ] **Step 1: Write the failing test `src/components/AuthGate.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import { vi, test, expect, beforeEach } from 'vitest'
import AuthGate from './AuthGate.jsx'

// Mock the session hook and supabase client.
vi.mock('../hooks/useSession.js', () => ({ useSession: vi.fn() }))
vi.mock('../lib/supabaseClient.js', () => ({
  supabase: { auth: { signInWithOtp: vi.fn(() => Promise.resolve({ error: null })) } },
}))
import { useSession } from '../hooks/useSession.js'

beforeEach(() => vi.clearAllMocks())

test('shows login form when logged out', () => {
  useSession.mockReturnValue({ session: null, loading: false })
  render(<AuthGate><div>secret</div></AuthGate>)
  expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
  expect(screen.queryByText('secret')).not.toBeInTheDocument()
})

test('renders children when logged in', () => {
  useSession.mockReturnValue({ session: { user: { id: '1' } }, loading: false })
  render(<AuthGate><div>secret</div></AuthGate>)
  expect(screen.getByText('secret')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AuthGate`
Expected: FAIL — `AuthGate` not found.

- [ ] **Step 3: Implement `src/components/AuthGate.jsx`**

```jsx
import { useState } from 'react'
import { useSession } from '../hooks/useSession.js'
import { supabase } from '../lib/supabaseClient.js'

export default function AuthGate({ children }) {
  const { session, loading } = useSession()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  if (loading) return <p>Loading…</p>
  if (session) return children

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '4rem auto' }}>
      <h1>MediaLog</h1>
      {sent ? (
        <p>Check your email for a login link.</p>
      ) : (
        <>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Send magic link</button>
          {error && <p style={{ color: 'crimson' }}>{error}</p>}
        </>
      )}
    </form>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- AuthGate`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AuthGate.jsx src/components/AuthGate.test.jsx
git commit -m "feat: add magic-link auth gate"
```

---

## Task 8: Topic + entry views

**Files:**
- Create: `src/components/EntryCard.jsx`, `src/components/EntryList.jsx`, `src/components/TopicList.jsx`
- Create tests: `src/components/EntryCard.test.jsx`, `src/components/TopicList.test.jsx`

- [ ] **Step 1: Write `src/components/EntryCard.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import EntryCard from './EntryCard.jsx'

test('renders title as link and note, fires delete', async () => {
  const onDelete = vi.fn()
  const entry = { id: 'x', url: 'http://a.com', title: 'A Site', note: 'my takeaway' }
  render(<EntryCard entry={entry} onDelete={onDelete} />)
  const link = screen.getByRole('link', { name: 'A Site' })
  expect(link).toHaveAttribute('href', 'http://a.com')
  expect(screen.getByText('my takeaway')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalledWith('x')
})

test('falls back to raw url when no title', () => {
  const entry = { id: 'y', url: 'http://b.com', title: null, note: '' }
  render(<EntryCard entry={entry} onDelete={() => {}} />)
  expect(screen.getByRole('link', { name: 'http://b.com' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- EntryCard`
Expected: FAIL — `EntryCard` not found.

- [ ] **Step 3: Implement `src/components/EntryCard.jsx`**

```jsx
export default function EntryCard({ entry, onDelete }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer">
          {entry.title || entry.url}
        </a>
      )}
      {entry.note && <p style={{ whiteSpace: 'pre-wrap' }}>{entry.note}</p>}
      <button onClick={() => onDelete(entry.id)} aria-label="delete">🗑</button>
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- EntryCard`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement `src/components/EntryList.jsx`** (no separate unit test — exercised via App; keep it thin)

```jsx
import EntryCard from './EntryCard.jsx'

export default function EntryList({ entries, onDelete }) {
  if (entries.length === 0) return <p>No entries yet.</p>
  return (
    <div>
      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} onDelete={onDelete} />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Write `src/components/TopicList.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import TopicList from './TopicList.jsx'

test('lists topics and selects one on click', async () => {
  const onSelect = vi.fn()
  const topics = [{ id: '1', name: 'AI' }, { id: '2', name: 'Film' }]
  render(<TopicList topics={topics} selectedId="1" onSelect={onSelect} onAdd={() => {}} />)
  await userEvent.click(screen.getByText('Film'))
  expect(onSelect).toHaveBeenCalledWith('2')
})

test('adds a new topic', async () => {
  const onAdd = vi.fn()
  render(<TopicList topics={[]} selectedId={null} onSelect={() => {}} onAdd={onAdd} />)
  await userEvent.type(screen.getByPlaceholderText(/new topic/i), 'Fitness')
  await userEvent.click(screen.getByRole('button', { name: /add/i }))
  expect(onAdd).toHaveBeenCalledWith('Fitness')
})
```

- [ ] **Step 7: Run test, verify it fails**

Run: `npm test -- TopicList`
Expected: FAIL — `TopicList` not found.

- [ ] **Step 8: Implement `src/components/TopicList.jsx`**

```jsx
import { useState } from 'react'

export default function TopicList({ topics, selectedId, onSelect, onAdd }) {
  const [name, setName] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <nav>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {topics.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => onSelect(t.id)}
              style={{ fontWeight: t.id === selectedId ? 'bold' : 'normal' }}
            >
              {t.name}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd}>
        <input
          placeholder="new topic"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </nav>
  )
}
```

- [ ] **Step 9: Run test, verify it passes**

Run: `npm test -- TopicList`
Expected: PASS (2 tests).

- [ ] **Step 10: Commit**

```bash
git add src/components/EntryCard.jsx src/components/EntryCard.test.jsx src/components/EntryList.jsx src/components/TopicList.jsx src/components/TopicList.test.jsx
git commit -m "feat: add topic list and entry views"
```

---

## Task 9: QuickAdd

**Files:**
- Create: `src/components/QuickAdd.jsx`, `src/components/QuickAdd.test.jsx`

- [ ] **Step 1: Write `src/components/QuickAdd.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import QuickAdd from './QuickAdd.jsx'

test('submits url + note and clears fields', async () => {
  const onAdd = vi.fn(() => Promise.resolve())
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.type(screen.getByPlaceholderText(/link/i), 'http://x.com')
  await userEvent.type(screen.getByPlaceholderText(/note/i), 'thought')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onAdd).toHaveBeenCalledWith({ url: 'http://x.com', note: 'thought' })
})

test('does not submit when both fields empty', async () => {
  const onAdd = vi.fn()
  render(<QuickAdd onAdd={onAdd} disabled={false} />)
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(onAdd).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- QuickAdd`
Expected: FAIL — `QuickAdd` not found.

- [ ] **Step 3: Implement `src/components/QuickAdd.jsx`**

```jsx
import { useState } from 'react'

export default function QuickAdd({ onAdd, disabled }) {
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const u = url.trim()
    const n = note.trim()
    if (!u && !n) return
    await onAdd({ url: u || null, note: n })
    setUrl('')
    setNote('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <input placeholder="link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <textarea placeholder="note / takeaway" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" disabled={disabled}>Save</button>
    </form>
  )
}
```

Note: the test types into the link field, so `url` is non-empty and submitted as `'http://x.com'`. When empty, `url.trim()` is `''`, and `u || null` yields `null` — matching `createEntry`'s expectations from Task 6.

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- QuickAdd`
Expected: PASS (2 tests). (First test asserts `{ url: 'http://x.com', note: 'thought' }` — `u` is truthy so passes through.)

- [ ] **Step 5: Commit**

```bash
git add src/components/QuickAdd.jsx src/components/QuickAdd.test.jsx
git commit -m "feat: add quick-add form"
```

---

## Task 10: SearchBar + wire App together

**Files:**
- Create: `src/components/SearchBar.jsx`
- Modify: `src/App.jsx` (replace placeholder)
- Modify: `src/App.test.jsx` (update smoke test for new structure)

- [ ] **Step 1: Implement `src/components/SearchBar.jsx`** (thin controlled input)

```jsx
export default function SearchBar({ value, onChange }) {
  return (
    <input
      type="search"
      placeholder="Search entries…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
```

- [ ] **Step 2: Replace `src/App.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient.js'
import { listTopics, createTopic } from './lib/db/topics.js'
import {
  listEntriesByTopic, createEntry, deleteEntry, searchEntries,
} from './lib/db/entries.js'
import AuthGate from './components/AuthGate.jsx'
import TopicList from './components/TopicList.jsx'
import EntryList from './components/EntryList.jsx'
import QuickAdd from './components/QuickAdd.jsx'
import SearchBar from './components/SearchBar.jsx'

function Workspace() {
  const [topics, setTopics] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [entries, setEntries] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    listTopics(supabase).then((t) => {
      setTopics(t)
      if (t.length && !selectedId) setSelectedId(t[0].id)
    })
  }, [])

  useEffect(() => {
    if (query.trim()) {
      searchEntries(supabase, query.trim()).then(setEntries)
    } else if (selectedId) {
      listEntriesByTopic(supabase, selectedId).then(setEntries)
    } else {
      setEntries([])
    }
  }, [selectedId, query])

  async function handleAddTopic(name) {
    const t = await createTopic(supabase, name)
    setTopics((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedId(t.id)
  }

  async function handleAddEntry({ url, note }) {
    const e = await createEntry(supabase, { topicId: selectedId, url, note })
    setEntries((prev) => [e, ...prev])
  }

  async function handleDelete(id) {
    await deleteEntry(supabase, id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div style={{ display: 'flex', gap: 24, padding: 16 }}>
      <aside style={{ minWidth: 160 }}>
        <h1>MediaLog</h1>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        <TopicList
          topics={topics}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setQuery('') }}
          onAdd={handleAddTopic}
        />
      </aside>
      <main style={{ flex: 1 }}>
        <SearchBar value={query} onChange={setQuery} />
        {!query && selectedId && (
          <QuickAdd onAdd={handleAddEntry} disabled={!selectedId} />
        )}
        <EntryList entries={entries} onDelete={handleDelete} />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      <Workspace />
    </AuthGate>
  )
}
```

- [ ] **Step 3: Update `src/App.test.jsx`** (App now requires the session hook; mock it as logged-out so the smoke test stays deterministic)

```jsx
import { render, screen } from '@testing-library/react'
import { vi, test, expect } from 'vitest'

vi.mock('./hooks/useSession.js', () => ({
  useSession: () => ({ session: null, loading: false }),
}))
vi.mock('./lib/supabaseClient.js', () => ({
  supabase: { auth: { signInWithOtp: vi.fn() } },
}))

import App from './App.jsx'

test('renders login when logged out', () => {
  render(<App />)
  expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
})
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS (all suites: App, topics, entries, AuthGate, EntryCard, TopicList, QuickAdd).

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open the local URL. Enter your email → click the magic link from your inbox → confirm you land in the Workspace, can add a topic, add an entry (link + note), see it appear, search for it, and delete it. Verify rows appear in Supabase Table Editor.

- [ ] **Step 6: Commit**

```bash
git add src/components/SearchBar.jsx src/App.jsx src/App.test.jsx
git commit -m "feat: wire app — topics, entries, quick-add, search"
```

---

## Task 11: README + deploy

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# MediaLog

A personal PWA media log — capture links, notes, and takeaways under flat topics.
Synced via Supabase. See `docs/superpowers/specs/2026-06-07-medialog-design.md`.

## Setup
1. Create a Supabase project. Run `supabase/migrations/0001_init.sql` in the SQL editor.
2. In Auth → Providers, ensure Email (magic link) is enabled.
3. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Settings → API).
4. `npm install` then `npm run dev`.

## Test
`npm test`

## Build & Deploy
`npm run build` produces static `dist/`. Deploy free to Netlify / Vercel / Cloudflare Pages:
set the same two `VITE_` env vars in the host's dashboard, build command `npm run build`,
publish directory `dist`. Add the deployed origin to Supabase Auth → URL Configuration
(Site URL + Redirect URLs) so magic links resolve.

## Install on iPhone
Open the deployed URL in Safari → Share → Add to Home Screen.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and deploy steps"
```

---

## Done criteria for Plan 1

- `npm test` passes all suites.
- `npm run build` produces an installable PWA (`dist/manifest.webmanifest` + service worker).
- Manually: log in via magic link, create topics, add/search/delete entries, data persists in Supabase across devices.
- Ready for Plan 2 (Edge Function enrichment, bulk import, Sort Inbox, iOS Shortcut).
