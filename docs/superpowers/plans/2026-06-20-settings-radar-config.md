# Settings — Opportunity Radar Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three tabs to SettingsView (Companies, Keywords, Programs) so the user can manage the opportunity radar without editing code.

**Architecture:** A new `companies` DB table replaces the hardcoded array in `careers.ts`. Twitter keywords and program rows are edited in-place via Supabase. SettingsView gains a tab bar; each tab is a self-contained section rendered conditionally. SettingsView already imports `supabase` directly — follow that pattern (do NOT use a prop).

**Tech Stack:** React 18, Vite 5, `@supabase/supabase-js` v2, Vitest + @testing-library/react, custom CSS in `src/styles.css`, Supabase Edge Functions (Deno)

## Global Constraints

- All CSS goes in `src/styles.css` only — no inline `<style>` blocks, no new files
- No new npm packages
- All existing tests must pass after every task (`npm test`)
- Follow existing CSS class naming: `settings-` prefix for new classes
- SettingsView imports supabase directly from `../lib/supabaseClient.js` — maintain this pattern
- `careers.ts` must fall back to the hardcoded COMPANIES array if the DB table is empty or unreachable (so the function works before migration is applied)

## DB Schema (applied by migration in Task 1)

```sql
-- companies table
id          uuid primary key default gen_random_uuid()
slug        text not null
name        text not null
ats         text not null  -- 'greenhouse' | 'lever' | 'ashby'
tags        text[] not null default '{}'
enabled     boolean not null default true
created_at  timestamptz default now()
unique (slug)

-- user_configs gets a new jsonb column: radar_keywords text[]
-- programs table already exists (from 0013_opportunities.sql)
```

---

## Task 1: Migration — companies table + radar_keywords column

**Files:**
- Create: `supabase/migrations/0016_companies.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0016_companies.sql

create table if not exists companies (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  ats        text not null check (ats in ('greenhouse','lever','ashby')),
  tags       text[] not null default '{}',
  enabled    boolean not null default true,
  created_at timestamptz default now()
);

alter table companies enable row level security;
create policy "companies: authenticated read" on companies
  for select using (auth.role() = 'authenticated');
create policy "companies: authenticated write" on companies
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- seed with the 21 companies currently hardcoded in careers.ts
insert into companies (slug, name, ats, tags) values
  ('anthropic',              'Anthropic',    'greenhouse', '{ai,research}'),
  ('openai',                 'OpenAI',       'greenhouse', '{ai,research}'),
  ('cohere',                 'Cohere',       'greenhouse', '{ai}'),
  ('mistral',                'Mistral',      'ashby',      '{ai}'),
  ('together-ai',            'Together AI',  'ashby',      '{ai}'),
  ('perplexity-ai',          'Perplexity',   'ashby',      '{ai}'),
  ('stripe',                 'Stripe',       'greenhouse', '{startup}'),
  ('linear',                 'Linear',       'ashby',      '{startup}'),
  ('vercel',                 'Vercel',       'ashby',      '{startup}'),
  ('anduril',                'Anduril',      'greenhouse', '{startup}'),
  ('figma',                  'Figma',        'greenhouse', '{startup}'),
  ('notion',                 'Notion',       'lever',      '{startup}'),
  ('google',                 'Google',       'greenhouse', '{big-tech}'),
  ('meta',                   'Meta',         'greenhouse', '{big-tech}'),
  ('apple',                  'Apple',        'greenhouse', '{big-tech}'),
  ('amazon-dev-center-u-s',  'Amazon',       'greenhouse', '{big-tech}'),
  ('microsoft',              'Microsoft',    'greenhouse', '{big-tech}'),
  ('two-sigma',              'Two Sigma',    'greenhouse', '{quant}'),
  ('citadel',                'Citadel',      'greenhouse', '{quant}'),
  ('hudson-river-trading',   'HRT',          'ashby',      '{quant}'),
  ('optiver',                'Optiver',      'greenhouse', '{quant}')
on conflict (slug) do nothing;

-- add radar_keywords to user_configs (safe if column already exists)
alter table user_configs add column if not exists radar_keywords text[] default '{}';
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Open Supabase → SQL Editor → paste and run `supabase/migrations/0016_companies.sql`.
Expected: no errors, `companies` table appears with 21 rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0016_companies.sql
git commit -m "feat: companies table and radar_keywords column migration"
```

---

## Task 2: Update `careers.ts` to read from DB

**Files:**
- Modify: `supabase/functions/fetch-opportunities/careers.ts`

This makes the edge function read companies from the DB instead of the hardcoded array. Falls back to hardcoded if DB is empty.

- [ ] **Step 1: Read the current file**

Read `supabase/functions/fetch-opportunities/careers.ts` before editing.

- [ ] **Step 2: Replace the file**

```typescript
// supabase/functions/fetch-opportunities/careers.ts
import type { Opportunity } from './hn.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type CompanyConfig = {
  slug: string
  name: string
  ats: 'greenhouse' | 'lever' | 'ashby'
  tags?: string[]
}

// Fallback if DB is empty or unreachable
const FALLBACK_COMPANIES: CompanyConfig[] = [
  { slug: 'anthropic',             name: 'Anthropic',   ats: 'greenhouse', tags: ['ai','research'] },
  { slug: 'openai',                name: 'OpenAI',      ats: 'greenhouse', tags: ['ai','research'] },
  { slug: 'stripe',                name: 'Stripe',      ats: 'greenhouse', tags: ['startup'] },
  { slug: 'two-sigma',             name: 'Two Sigma',   ats: 'greenhouse', tags: ['quant'] },
  { slug: 'citadel',               name: 'Citadel',     ats: 'greenhouse', tags: ['quant'] },
  { slug: 'hudson-river-trading',  name: 'HRT',         ats: 'ashby',      tags: ['quant'] },
]

async function loadCompanies(): Promise<CompanyConfig[]> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data, error } = await supabase
      .from('companies')
      .select('slug, name, ats, tags')
      .eq('enabled', true)
    if (error || !data?.length) return FALLBACK_COMPANIES
    return data as CompanyConfig[]
  } catch {
    return FALLBACK_COMPANIES
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
}

async function fetchGreenhouse(c: CompanyConfig): Promise<Opportunity[]> {
  const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`)
  if (!r.ok) return []
  const json = await r.json()
  return (json.jobs ?? []).map((j: any) => ({
    source: 'greenhouse',
    company: c.name,
    title: j.title,
    body: j.content ? stripHtml(j.content) : null,
    url: j.absolute_url,
    author: null,
    posted_at: j.updated_at ?? null,
    tags: c.tags ?? [],
  }))
}

async function fetchLever(c: CompanyConfig): Promise<Opportunity[]> {
  const r = await fetch(`https://api.lever.co/v0/postings/${c.slug}?mode=json`)
  if (!r.ok) return []
  const json = await r.json()
  return (json ?? []).map((j: any) => ({
    source: 'lever',
    company: c.name,
    title: j.text,
    body: j.description ? stripHtml(j.description) : null,
    url: j.hostedUrl,
    author: null,
    posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    tags: c.tags ?? [],
  }))
}

async function fetchAshby(c: CompanyConfig): Promise<Opportunity[]> {
  const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${c.slug}`)
  if (!r.ok) return []
  const json = await r.json()
  return (json.jobPostings ?? []).map((j: any) => ({
    source: 'ashby',
    company: c.name,
    title: j.title,
    body: j.descriptionHtml ? stripHtml(j.descriptionHtml) : null,
    url: j.jobUrl,
    author: null,
    posted_at: j.publishedDate ?? null,
    tags: c.tags ?? [],
  }))
}

export async function fetchCareers(): Promise<Opportunity[]> {
  const companies = await loadCompanies()
  const results = await Promise.allSettled(
    companies.map((c) => {
      if (c.ats === 'greenhouse') return fetchGreenhouse(c)
      if (c.ats === 'lever') return fetchLever(c)
      return fetchAshby(c)
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<Opportunity[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
}
```

- [ ] **Step 3: Deploy the updated function**

```bash
supabase functions deploy fetch-opportunities
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/fetch-opportunities/careers.ts
git commit -m "feat: careers fetcher reads companies from DB with hardcoded fallback"
```

---

## Task 3: Settings CSS

**Files:**
- Modify: `src/styles.css`

Append all CSS needed for Tasks 4–6.

- [ ] **Step 1: Append to `src/styles.css`**

```css
/* ── Settings tabs ───────────────────────────────────────────────────────────── */
.settings-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
  padding-bottom: 8px;
}
.settings-tab {
  font-size: var(--text-sm);
  padding: 6px 14px;
  border-radius: 7px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--muted);
  cursor: pointer;
}
.settings-tab:hover { background: var(--surface-2); color: var(--text); }
.settings-tab.active { background: var(--accent-weak); color: var(--accent); border-color: var(--accent); font-weight: 600; }

/* ── Settings companies table ────────────────────────────────────────────────── */
.settings-companies-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
  margin-bottom: 16px;
}
.settings-companies-table th {
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}
.settings-companies-table td {
  padding: 8px 8px;
  border-bottom: 1px solid var(--surface-2);
  vertical-align: middle;
}
.settings-companies-table tr:last-child td { border-bottom: none; }
.settings-company-slug { font-family: monospace; font-size: 12px; color: var(--muted); }
.settings-company-ats {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--surface-2);
  color: var(--muted);
}
.settings-company-tags { font-size: 11px; color: var(--muted); }
.settings-enabled-toggle { cursor: pointer; width: 16px; height: 16px; }
.settings-delete-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
}
.settings-delete-btn:hover { color: var(--danger); }

.settings-add-form {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: flex-end;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}
.settings-add-form > div { display: flex; flex-direction: column; gap: 4px; }
.settings-add-form label { font-size: var(--text-xs); color: var(--muted); font-weight: 500; }
.settings-add-form input,
.settings-add-form select { font-size: var(--text-sm); min-width: 120px; }
.settings-add-form button[type="submit"] {
  padding: 7px 14px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: var(--text-sm);
  font-weight: 600;
  align-self: flex-end;
}

/* ── Settings keywords ───────────────────────────────────────────────────────── */
.settings-keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.settings-keyword-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 3px 10px;
  font-size: var(--text-sm);
}
.settings-keyword-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-size: 13px;
  padding: 0 2px;
  line-height: 1;
}
.settings-keyword-remove:hover { color: var(--danger); }
.settings-keyword-add { display: flex; gap: 6px; }
.settings-keyword-add input { flex: 1; font-size: var(--text-sm); }
.settings-keyword-add button {
  padding: 6px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: var(--text-sm);
}

/* ── Settings programs table ─────────────────────────────────────────────────── */
.settings-programs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}
.settings-programs-table th {
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}
.settings-programs-table td { padding: 8px 8px; border-bottom: 1px solid var(--surface-2); vertical-align: middle; }
.settings-programs-table tr:last-child td { border-bottom: none; }
.settings-program-name { font-weight: 500; }
.settings-program-deadline input { font-size: var(--text-sm); border: 1px solid var(--border); border-radius: 5px; padding: 3px 6px; }
.settings-open-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
}
.settings-open-badge.open { background: #DCFCE7; color: #15803D; }
.settings-open-badge.closed { background: var(--surface-2); color: var(--muted); border-color: var(--border); }
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --run
```
Expected: same pass/fail as before (CSS-only change).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: settings radar config CSS — tabs, companies table, keywords, programs"
```

---

## Task 4: Companies tab component

**Files:**
- Create: `src/components/settings/CompaniesTab.jsx`
- Create: `src/components/settings/CompaniesTab.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop
- Produces: nothing consumed by other components

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/settings/CompaniesTab.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import CompaniesTab from './CompaniesTab.jsx'

function mockRow(overrides = {}) {
  return { id: 'c1', slug: 'stripe', name: 'Stripe', ats: 'greenhouse', tags: ['startup'], enabled: true, ...overrides }
}

function mockSupabase(rows = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const deleteFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: mockRow({ id: 'new' }), error: null }) })
  }))
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: rows, error: null })) })),
      update: updateFn,
      delete: deleteFn,
      insert: insertFn,
    })),
    _updateFn: updateFn,
    _deleteFn: deleteFn,
    _insertFn: insertFn,
  }
}

test('renders company rows', async () => {
  render(<CompaniesTab supabase={mockSupabase([mockRow()])} />)
  expect(await screen.findByText('Stripe')).toBeInTheDocument()
  expect(screen.getByText('stripe')).toBeInTheDocument()
})

test('toggling enabled calls update', async () => {
  const sb = mockSupabase([mockRow()])
  render(<CompaniesTab supabase={sb} />)
  await screen.findByText('Stripe')
  const checkbox = screen.getByRole('checkbox')
  await userEvent.click(checkbox)
  expect(sb._updateFn).toHaveBeenCalled()
})

test('delete button calls delete', async () => {
  const sb = mockSupabase([mockRow()])
  render(<CompaniesTab supabase={sb} />)
  await screen.findByText('Stripe')
  await userEvent.click(screen.getByRole('button', { name: '×' }))
  expect(sb._deleteFn).toHaveBeenCalled()
})

test('add form inserts new company', async () => {
  const sb = mockSupabase([])
  render(<CompaniesTab supabase={sb} />)
  await waitFor(() => {})
  await userEvent.type(screen.getByPlaceholderText('slug'), 'linear')
  await userEvent.type(screen.getByPlaceholderText('Display name'), 'Linear')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(sb._insertFn).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/settings/CompaniesTab.test.jsx
```
Expected: FAIL — `CompaniesTab` not found.

- [ ] **Step 3: Implement `src/components/settings/CompaniesTab.jsx`**

```jsx
import { useEffect, useState, useCallback } from 'react'

const ATS_OPTIONS = ['greenhouse', 'lever', 'ashby']
const TAG_OPTIONS = ['ai', 'research', 'startup', 'big-tech', 'quant', 'product', 'vc']

const EMPTY_FORM = { slug: '', name: '', ats: 'greenhouse', tags: 'startup' }

export default function CompaniesTab({ supabase }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('companies').select('*').order('name')
    if (data) setRows(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function toggleEnabled(id, current) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !current } : r))
    await supabase.from('companies').update({ enabled: !current }).eq('id', id)
  }

  async function deleteRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id))
    await supabase.from('companies').delete().eq('id', id)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.slug.trim() || !form.name.trim()) return
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    const { data } = await supabase
      .from('companies')
      .insert({ slug: form.slug.trim(), name: form.name.trim(), ats: form.ats, tags, enabled: true })
      .select()
      .single()
    if (data) setRows((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(EMPTY_FORM)
  }

  if (loading) return <p className="kw-empty">Loading…</p>

  return (
    <div>
      <table className="settings-companies-table">
        <thead>
          <tr>
            <th>On</th>
            <th>Name</th>
            <th>Slug</th>
            <th>ATS</th>
            <th>Tags</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <input
                  type="checkbox"
                  className="settings-enabled-toggle"
                  checked={r.enabled}
                  onChange={() => toggleEnabled(r.id, r.enabled)}
                />
              </td>
              <td>{r.name}</td>
              <td><span className="settings-company-slug">{r.slug}</span></td>
              <td><span className="settings-company-ats">{r.ats}</span></td>
              <td><span className="settings-company-tags">{(r.tags ?? []).join(', ')}</span></td>
              <td>
                <button className="settings-delete-btn" onClick={() => deleteRow(r.id)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="settings-add-form" onSubmit={handleAdd}>
        <div>
          <label>Slug</label>
          <input placeholder="slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
        </div>
        <div>
          <label>Display name</label>
          <input placeholder="Display name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label>ATS</label>
          <select value={form.ats} onChange={(e) => setForm((f) => ({ ...f, ats: e.target.value }))}>
            {ATS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label>Tags (comma-sep)</label>
          <input placeholder="startup,ai" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
        </div>
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/settings/CompaniesTab.test.jsx
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/CompaniesTab.jsx src/components/settings/CompaniesTab.test.jsx
git commit -m "feat: companies settings tab — toggle, delete, add"
```

---

## Task 5: Keywords tab component

**Files:**
- Create: `src/components/settings/KeywordsTab.jsx`
- Create: `src/components/settings/KeywordsTab.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop
- Produces: nothing consumed by other components
- Reads/writes: `user_configs.radar_keywords` (text[])

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/settings/KeywordsTab.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import KeywordsTab from './KeywordsTab.jsx'

function mockSupabase(keywords = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } } })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: { user_id: 'u1', radar_keywords: keywords }, error: null })),
        })),
      })),
      update: updateFn,
    })),
    _updateFn: updateFn,
  }
}

test('renders existing keywords as chips', async () => {
  render(<KeywordsTab supabase={mockSupabase(['internship', 'fellowship'])} />)
  expect(await screen.findByText('internship')).toBeInTheDocument()
  expect(screen.getByText('fellowship')).toBeInTheDocument()
})

test('adding a keyword calls update', async () => {
  const sb = mockSupabase(['internship'])
  render(<KeywordsTab supabase={sb} />)
  await screen.findByText('internship')
  await userEvent.type(screen.getByPlaceholderText(/keyword/i), 'fellowship')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(sb._updateFn).toHaveBeenCalled()
})

test('removing a keyword calls update', async () => {
  const sb = mockSupabase(['internship'])
  render(<KeywordsTab supabase={sb} />)
  await screen.findByText('internship')
  await userEvent.click(screen.getByRole('button', { name: '×' }))
  expect(sb._updateFn).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/settings/KeywordsTab.test.jsx
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/settings/KeywordsTab.jsx`**

```jsx
import { useEffect, useState, useCallback } from 'react'

export default function KeywordsTab({ supabase }) {
  const [keywords, setKeywords] = useState([])
  const [userId, setUserId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const { data } = await supabase
      .from('user_configs')
      .select('radar_keywords')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) setKeywords(data.radar_keywords ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function save(next) {
    setKeywords(next)
    await supabase.from('user_configs').update({ radar_keywords: next }).eq('user_id', userId)
  }

  async function add(e) {
    e.preventDefault()
    const kw = input.trim().toLowerCase()
    if (!kw || keywords.includes(kw)) return
    await save([...keywords, kw])
    setInput('')
  }

  async function remove(kw) {
    await save(keywords.filter((k) => k !== kw))
  }

  if (loading) return <p className="kw-empty">Loading…</p>

  return (
    <div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginBottom: 12 }}>
        Twitter source searches for tweets containing any of these keywords. Editing takes effect on the next hourly fetch.
      </p>
      <div className="settings-keywords-list">
        {keywords.map((kw) => (
          <span key={kw} className="settings-keyword-chip">
            {kw}
            <button className="settings-keyword-remove" onClick={() => remove(kw)}>×</button>
          </span>
        ))}
        {keywords.length === 0 && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>No keywords yet.</span>}
      </div>
      <form className="settings-keyword-add" onSubmit={add}>
        <input
          placeholder="keyword or phrase…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/settings/KeywordsTab.test.jsx
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/KeywordsTab.jsx src/components/settings/KeywordsTab.test.jsx
git commit -m "feat: keywords settings tab — add/remove Twitter radar keywords"
```

---

## Task 6: Programs tab component

**Files:**
- Create: `src/components/settings/ProgramsTab.jsx`
- Create: `src/components/settings/ProgramsTab.test.jsx`

**Interfaces:**
- Consumes: `supabase` prop
- Produces: nothing consumed by other components
- Reads/writes: `programs` table (id, name, url, category, deadline, window_open, notes)

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/settings/ProgramsTab.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import ProgramsTab from './ProgramsTab.jsx'

function mockProgram(overrides = {}) {
  return {
    id: 'p1', name: 'Neo Scholars', url: 'https://neo.com',
    category: 'program', deadline: null, window_open: false, notes: null,
    ...overrides,
  }
}

function mockSupabase(programs = []) {
  const updateFn = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: mockProgram({ id: 'new', name: 'New Program' }), error: null }) })
  }))
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: programs, error: null })) })),
      update: updateFn,
      insert: insertFn,
    })),
    _updateFn: updateFn,
    _insertFn: insertFn,
  }
}

test('renders program rows', async () => {
  render(<ProgramsTab supabase={mockSupabase([mockProgram()])} />)
  expect(await screen.findByText('Neo Scholars')).toBeInTheDocument()
})

test('clicking window badge toggles window_open', async () => {
  const sb = mockSupabase([mockProgram({ window_open: false })])
  render(<ProgramsTab supabase={sb} />)
  await screen.findByText('Neo Scholars')
  await userEvent.click(screen.getByRole('button', { name: 'closed' }))
  expect(sb._updateFn).toHaveBeenCalled()
})

test('add form inserts a new program', async () => {
  const sb = mockSupabase([])
  render(<ProgramsTab supabase={sb} />)
  await waitFor(() => {})
  await userEvent.click(screen.getByRole('button', { name: '+ add program' }))
  await userEvent.type(screen.getByPlaceholderText('Program name'), 'New Program')
  await userEvent.type(screen.getByPlaceholderText('URL'), 'https://example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(sb._insertFn).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/settings/ProgramsTab.test.jsx
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/settings/ProgramsTab.jsx`**

```jsx
import { useEffect, useState, useCallback } from 'react'

const CATEGORIES = ['fellowship', 'program', 'cohort', 'internship', 'research']
const EMPTY_FORM = { name: '', url: '', category: 'fellowship', deadline: '', notes: '' }

export default function ProgramsTab({ supabase }) {
  const [programs, setPrograms] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('programs').select('*').order('name')
    if (data) setPrograms(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function toggleWindow(id, current) {
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, window_open: !current } : p))
    await supabase.from('programs').update({ window_open: !current }).eq('id', id)
  }

  async function updateDeadline(id, deadline) {
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, deadline: deadline || null } : p))
    await supabase.from('programs').update({ deadline: deadline || null }).eq('id', id)
  }

  async function handleAdd(e) {
    e.preventDefault()
    const { data } = await supabase
      .from('programs')
      .insert({
        name: form.name.trim(),
        url: form.url.trim(),
        category: form.category,
        deadline: form.deadline || null,
        notes: form.notes.trim() || null,
        window_open: false,
      })
      .select()
      .single()
    if (data) setPrograms((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(EMPTY_FORM)
    setShowAdd(false)
  }

  if (loading) return <p className="kw-empty">Loading…</p>

  return (
    <div>
      <table className="settings-programs-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Deadline</th>
            <th>Window</th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => (
            <tr key={p.id}>
              <td>
                <a href={p.url} target="_blank" rel="noreferrer" className="settings-program-name">{p.name}</a>
              </td>
              <td style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>{p.category}</td>
              <td className="settings-program-deadline">
                <input
                  type="date"
                  value={p.deadline?.slice(0, 10) ?? ''}
                  onChange={(e) => updateDeadline(p.id, e.target.value)}
                />
              </td>
              <td>
                <button
                  className={`settings-open-badge ${p.window_open ? 'open' : 'closed'}`}
                  onClick={() => toggleWindow(p.id, p.window_open)}
                >
                  {p.window_open ? 'open' : 'closed'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAdd ? (
        <form className="settings-add-form" onSubmit={handleAdd} style={{ marginTop: 16 }}>
          <div>
            <label>Name</label>
            <input placeholder="Program name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label>URL</label>
            <input placeholder="URL" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} required />
          </div>
          <div>
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>Deadline</label>
            <input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          </div>
          <button type="submit">Save</button>
          <button type="button" onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)' }}>Cancel</button>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--muted)', background: 'none', border: '1px dashed var(--border)', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', width: '100%' }}
        >
          + add program
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/components/settings/ProgramsTab.test.jsx
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/ProgramsTab.jsx src/components/settings/ProgramsTab.test.jsx
git commit -m "feat: programs settings tab — toggle window, edit deadline, add program"
```

---

## Task 7: Wire tabs into SettingsView

**Files:**
- Modify: `src/components/SettingsView.jsx`

- [ ] **Step 1: Read current `src/components/SettingsView.jsx`**

(Read before editing.)

- [ ] **Step 2: Add tab state and imports**

At the top of the file, add imports:
```jsx
import CompaniesTab from './settings/CompaniesTab.jsx'
import KeywordsTab from './settings/KeywordsTab.jsx'
import ProgramsTab from './settings/ProgramsTab.jsx'
```

Add `tab` state inside the component (after existing state):
```jsx
const [tab, setTab] = useState('github')
```

- [ ] **Step 3: Replace the returned JSX**

Replace the entire `return (...)` block with:

```jsx
  const TABS = [
    { id: 'github',    label: 'GitHub' },
    { id: 'behavior',  label: 'Behavior' },
    { id: 'tags',      label: 'Tag Colors' },
    { id: 'companies', label: 'Companies' },
    { id: 'keywords',  label: 'Keywords' },
    { id: 'programs',  label: 'Programs' },
  ]

  return (
    <div className="settings-view">
      <div className="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`settings-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'github' && (
        <section>
          <h2>GitHub Backup</h2>
          {!config?.github_user ? (
            <div className="card">
              <p className="muted">Connect your GitHub account to enable automatic backups in Markdown format.</p>
              <button onClick={handleConnect}>Connect GitHub</button>
            </div>
          ) : (
            <div className="card">
              <p>Connected as <strong>{config.github_user}</strong></p>
              <div className="form-group">
                <label>Repository Name</label>
                <input type="text" value={config.repo_name} onChange={e => setConfig({...config, repo_name: e.target.value})} />
              </div>
              <div className="form-group inline">
                <label>
                  <input type="checkbox" checked={config.is_private} onChange={e => setConfig({...config, is_private: e.target.checked})} />
                  Private Repository
                </label>
              </div>
              <div className="form-group inline">
                <label>
                  <input type="checkbox" checked={config.auto_backup} onChange={e => setConfig({...config, auto_backup: e.target.checked})} />
                  Automatic Backups
                </label>
              </div>
              <div className="actions">
                <button className="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
                <button onClick={handleBackup}>Backup Now</button>
                <button className="danger" onClick={handleRestore}>Restore from GitHub</button>
              </div>
              {config.last_backup_at && (
                <p className="muted" style={{ marginTop: '1rem' }}>
                  Last backup: {new Date(config.last_backup_at).toLocaleString()}
                </p>
              )}
              <p className="backup-note">
                <strong>Note:</strong> The GitHub backup contains your entry text and metadata only.
                File attachments are stored in Supabase storage and are <em>not</em> committed to git.
              </p>
            </div>
          )}
        </section>
      )}

      {tab === 'behavior' && (
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
      )}

      {tab === 'tags' && (
        <section>
          <h3 className="section-label">Tag Colors</h3>
          {allTags.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No tags yet.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allTags.map(tag => (
              <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13, padding: '2px 8px', borderRadius: 5, background: tag.color || 'var(--surface-3)' }}>#{tag.name}</span>
                <input
                  type="color"
                  value={pendingColors[tag.name] ?? tag.color ?? '#e8e3d8'}
                  onChange={(e) => setPendingColors(prev => ({ ...prev, [tag.name]: e.target.value }))}
                  onBlur={(e) => { const c = e.target.value; if (c !== (tag.color || '#e8e3d8')) onUpdateTagColor(tag.name, c) }}
                  style={{ width: 32, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                />
                <button style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => onUpdateTagColor(tag.name, null)}>✕</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'companies' && <CompaniesTab supabase={supabase} />}
      {tab === 'keywords' && <KeywordsTab supabase={supabase} />}
      {tab === 'programs' && <ProgramsTab supabase={supabase} />}

      <style dangerouslySetInnerHTML={{ __html: `
        .settings-view { max-width: 700px; margin: 0 auto; padding: 2rem; }
        .card { background: var(--bg-card); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
        .form-group.inline label { display: flex; align-items: center; gap: 0.5rem; font-weight: 400; cursor: pointer; }
        .form-group input[type="text"] { width: 100%; }
        .actions { display: flex; gap: 1rem; margin-top: 2rem; }
        .section-label { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }
      `}} />
    </div>
  )
```

Note: SettingsView already imports `supabase` directly from `../lib/supabaseClient.js` — pass it directly to the tab components: `<CompaniesTab supabase={supabase} />`.

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --run
```
Expected: same pass/fail as before (no new failures).

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsView.jsx
git commit -m "feat: settings tab bar — GitHub, Behavior, Tags, Companies, Keywords, Programs"
```

---

## Done Criteria

- `npm test` passes all suites
- Settings page shows 6 tabs across the top
- Companies tab: lists all 21 companies, enable/disable checkbox per row, delete button, add form with slug/name/ATS/tags
- Keywords tab: shows current `radar_keywords` from DB as chips, add/remove chips, saves on change
- Programs tab: shows all programs, click deadline to edit inline, click window badge to toggle open/closed, + add program button
- Redeploy `fetch-opportunities` after Task 2 — companies come from DB, not hardcode
