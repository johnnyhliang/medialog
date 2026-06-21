# Pre-Ship Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the security gaps and UX papercuts that would bite real users before this app ships beyond personal use.

**Architecture:** Edge functions get JWT verification via the Supabase anon client; cron-only functions get a shared secret guard. Frontend gets CSS media-query fixes for touch devices, a confirm dialog for destructive topic deletion, and a DB migration adding length constraints. Private storage (signed URLs) is deferred — UUID-based paths + per-user RLS already make files practically unguessable for a personal tool.

**Tech Stack:** Deno edge functions (Supabase), React 18, Vitest + @testing-library/react, PostgreSQL (Supabase), `jsr:@supabase/supabase-js@2` in Deno

## Global Constraints

- Edge functions use Deno runtime — import Supabase as `jsr:@supabase/supabase-js@2`
- Frontend tests run with `npx vitest run <path>` from the repo root
- Deploy edge functions with `npx supabase functions deploy <name>`
- Never commit `.env` or `.env.local`
- Secrets are set via `npx supabase secrets set KEY=value` (or Supabase dashboard → Settings → Edge Functions)
- Migration files go in `supabase/migrations/` and are applied with `npx supabase db push`

---

### Task 1: JWT auth on `enrich` and `ai` edge functions

**Files:**
- Modify: `supabase/functions/enrich/index.ts`
- Modify: `supabase/functions/ai/index.ts`

**Interfaces:**
- Consumes: `Authorization: Bearer <supabase-jwt>` header on every request (the Supabase JS client sends this automatically via `supabase.functions.invoke(...)`)
- Produces: 401 JSON `{ error: 'unauthorized' }` for unauthenticated callers

**Context:** `enrich` currently has zero auth — anyone who finds its URL can use your Supabase as a free web proxy. `ai` has zero auth — anyone can burn your AI API credits. Both are called from the frontend via `supabase.functions.invoke(...)`, which automatically attaches the logged-in user's JWT as the `Authorization` header, so adding the check here requires no frontend changes.

- [ ] **Step 1: Update `enrich/index.ts`**

Replace the entire file with:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { extractMetadata } from '../_shared/extractTitle.ts'
import { isSafeUrl } from '../_shared/isSafeUrl.ts'

const MAX_BYTES = 512 * 1024
const TIMEOUT_MS = 6000

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const OEMBED_PROVIDERS: Array<{ test: RegExp; endpoint: string }> = [
  { test: /youtube\.com\/watch|youtu\.be\//, endpoint: 'https://www.youtube.com/oembed' },
  { test: /vimeo\.com\//, endpoint: 'https://vimeo.com/api/oembed.json' },
]

async function tryOembed(url: string, controller: AbortController): Promise<{ title: string | null; image: string | null; description: string | null } | null> {
  const provider = OEMBED_PROVIDERS.find((p) => p.test.test(url))
  if (!provider) return null
  try {
    const endpoint = `${provider.endpoint}?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(endpoint, { signal: controller.signal })
    if (!res.ok) return null
    const json = await res.json()
    return {
      title: json.title ?? null,
      image: json.thumbnail_url ?? null,
      description: json.author_name ? `by ${json.author_name}` : null,
    }
  } catch { return null }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Verify caller is a logged-in Supabase user
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return unauthorized()
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return unauthorized()

  let url: string | null = new URL(req.url).searchParams.get('url')
  if (!url && req.method === 'POST') {
    try { url = (await req.json())?.url ?? null } catch { url = null }
  }
  if (!url) {
    return new Response(JSON.stringify({ error: 'missing url' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  if (!isSafeUrl(url)) {
    return new Response(JSON.stringify({ error: 'url not allowed' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let site = ''
  try { site = new URL(url).hostname } catch { /* ignore */ }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let result: { title: string | null; site: string; image: string | null; description: string | null }
    try {
      const oembed = await tryOembed(url, controller)
      if (oembed) {
        result = { ...oembed, site }
      } else {
        const res = await fetch(url, {
          headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          redirect: 'follow',
          signal: controller.signal,
        })
        const buf = new Uint8Array(await res.arrayBuffer())
        const html = new TextDecoder().decode(buf.slice(0, MAX_BYTES))
        result = extractMetadata(html, url)
      }
    } finally {
      clearTimeout(timer)
    }
    return new Response(JSON.stringify(result), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (_e) {
    return new Response(JSON.stringify({ title: null, site, image: null, description: null }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
```

- [ ] **Step 2: Update `ai/index.ts`**

Replace the entire file with:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

  // Verify caller is a logged-in Supabase user
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  if (!body || (!body.messages && !body.prompt)) {
    return json({ error: 'missing prompt or messages' }, 400)
  }

  const baseUrl = Deno.env.get('AI_BASE_URL')
  const apiKey = Deno.env.get('AI_API_KEY')
  const model = body.model || Deno.env.get('AI_MODEL')
  if (!baseUrl || !apiKey || !model) return json({ error: 'AI provider not configured' }, 500)

  const messages = body.messages || [
    ...(body.system ? [{ role: 'system', content: body.system }] : []),
    { role: 'user', content: body.prompt },
  ]
  const payload: Record<string, unknown> = { model, messages, temperature: 0 }
  if (body.json) payload.response_format = { type: 'json_object' }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    let res: Response
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } finally { clearTimeout(timer) }
    if (!res.ok) {
      const text = await res.text()
      return json({ error: `provider ${res.status}`, detail: text.slice(0, 500) }, 502)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? null
    return json({ content })
  } catch (e) {
    return json({ error: 'request failed', detail: String(e).slice(0, 200) }, 502)
  }
})
```

- [ ] **Step 3: Deploy both functions**

```bash
npx supabase functions deploy enrich
npx supabase functions deploy ai
```

Expected: `Deployed Functions enrich` and `Deployed Functions ai` with no errors.

- [ ] **Step 4: Manual smoke test**

In the browser, open the app and paste a URL into QuickAdd. Confirm the title still fetches (enrich auth works). If it fails, open DevTools → Network, find the `enrich` request, confirm it has an `Authorization: Bearer ...` header — if missing, the frontend is calling `fetch()` directly instead of `supabase.functions.invoke()`. Check `src/lib/enrich.js`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/enrich/index.ts supabase/functions/ai/index.ts
git commit -m "security: JWT auth on enrich and ai edge functions"
```

---

### Task 2: CRON_SECRET guard on `fetch-opportunities` and `fetch-programs`

**Files:**
- Modify: `supabase/functions/fetch-opportunities/index.ts`
- Modify: `supabase/functions/fetch-programs/index.ts`
- Create: `supabase/migrations/0019_cron_secret.sql`

**Context:** Both functions are called by pg_cron with no authentication. Anyone who finds the URL can trigger external API calls on your behalf (burning HN/GitHub/Twitter rate limits and running with the service role key). Fix: add a `CRON_SECRET` env var; the function checks a `X-Cron-Secret` request header. The cron SQL is updated to send this header via pg_net's named-param form.

- [ ] **Step 1: Generate and set the secret**

```bash
# Generate a random secret (run this locally, save the output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Then set it:
npx supabase secrets set CRON_SECRET=<the-generated-value>
```

- [ ] **Step 2: Update `fetch-opportunities/index.ts`**

Add the secret check immediately after the `serve(async (req) =>` line. Replace the existing `serve` call opening:

```typescript
serve(async (req) => {
  // Guard: only accept calls from pg_cron (which sends X-Cron-Secret)
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const incoming = req.headers.get('X-Cron-Secret')
    if (incoming !== cronSecret) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const supabase = createClient(
    // ... rest unchanged
```

- [ ] **Step 3: Update `fetch-programs/index.ts`**

Same guard, same location:

```typescript
serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const incoming = req.headers.get('X-Cron-Secret')
    if (incoming !== cronSecret) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const supabase = createClient(
    // ... rest unchanged
```

- [ ] **Step 4: Create migration to reschedule cron jobs with the secret header**

Create `supabase/migrations/0019_cron_secret.sql`:

```sql
-- Reschedule cron jobs to include X-Cron-Secret header.
-- The secret value must be set as a Supabase secret (CRON_SECRET) before deploying.
-- Replace <YOUR_PROJECT_REF> with your actual project ref (already in 0015_cron_jobs.sql).

select cron.unschedule('fetch-opportunities-hourly');
select cron.unschedule('fetch-programs-daily');

select cron.schedule(
  'fetch-opportunities-hourly',
  '0 * * * *',
  $$ select net.http_post(
    url := 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/fetch-opportunities',
    body := '{}'::jsonb,
    headers := format('{"X-Cron-Secret": "%s"}', current_setting('app.cron_secret', true))::jsonb
  ) $$
);

select cron.schedule(
  'fetch-programs-daily',
  '0 8 * * *',
  $$ select net.http_post(
    url := 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/fetch-programs',
    body := '{}'::jsonb,
    headers := format('{"X-Cron-Secret": "%s"}', current_setting('app.cron_secret', true))::jsonb
  ) $$
);
```

- [ ] **Step 5: Set the postgres config for the cron secret**

In the Supabase SQL editor (or via `npx supabase db execute`), run once:

```sql
alter database postgres set app.cron_secret = '<the-same-secret-you-set-in-step-1>';
```

- [ ] **Step 6: Apply migration and deploy**

```bash
npx supabase db push
npx supabase functions deploy fetch-opportunities
npx supabase functions deploy fetch-programs
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/fetch-opportunities/index.ts supabase/functions/fetch-programs/index.ts supabase/migrations/0019_cron_secret.sql
git commit -m "security: CRON_SECRET guard on fetch-opportunities and fetch-programs"
```

---

### Task 3: Mobile touch UI — hover-only interactions

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/TopicList.jsx`

**Context:** The topic three-dot menu button is hidden with `display: none` and only revealed via CSS `:hover`. On iPhone (the primary install target), hover doesn't fire — making the menu permanently invisible. Fix with two layers: (1) a CSS `@media (hover: none)` rule that always shows the button on touch devices, and (2) a tap-to-toggle fallback in the component so the menu works without a pointer.

- [ ] **Step 1: Add touch CSS to `src/styles.css`**

Append after the existing `.topic-menu-btn:hover` rule (search for `.fw-see-all:hover { color: var(--text); }` at the end of the file, it's after the topic lifecycle CSS block):

```css
/* Always show three-dot menus on touch devices (no hover available) */
@media (hover: none) {
  .topic-menu-btn { display: flex; align-items: center; }
}
```

- [ ] **Step 2: Verify the CSS change works**

Run `npm run dev`, open in a mobile browser or Chrome DevTools mobile emulation. The three-dot button next to topic names should now be visible without tapping first.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "fix: show topic menu button on touch devices (hover: none media query)"
```

---

### Task 4: Confirm dialog before topic delete

**Files:**
- Modify: `src/components/TopicList.jsx`
- Modify: `src/components/TopicList.test.jsx`

**Context:** Clicking Delete in the topic three-dot menu immediately calls `onDeleteTopic(id)` with no confirmation. This soft-deletes the topic and all its entries in one shot. Add an in-component confirm dialog using the existing `ConfirmModal` component.

- [ ] **Step 1: Write failing test**

Add to `src/components/TopicList.test.jsx`, after the existing tests:

```jsx
test('topic delete requires confirmation — cancel does not delete', async () => {
  const onDeleteTopic = vi.fn()
  render(<TopicList {...baseProps} onDeleteTopic={onDeleteTopic} />)
  await userEvent.hover(screen.getByRole('button', { name: 'AI' }))
  await userEvent.click(screen.getByRole('button', { name: /topic menu/i }))
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  // Confirm modal should appear
  expect(screen.getByText(/permanently delete/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(onDeleteTopic).not.toHaveBeenCalled()
})

test('topic delete confirm dialog calls onDeleteTopic on confirm', async () => {
  const onDeleteTopic = vi.fn()
  render(<TopicList {...baseProps} onDeleteTopic={onDeleteTopic} />)
  await userEvent.hover(screen.getByRole('button', { name: 'AI' }))
  await userEvent.click(screen.getByRole('button', { name: /topic menu/i }))
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
  expect(onDeleteTopic).toHaveBeenCalledWith('a1')
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/TopicList.test.jsx
```

Expected: 2 new failures (modal not found).

- [ ] **Step 3: Update `src/components/TopicList.jsx`**

Add the import at the top:

```jsx
import ConfirmModal from './ConfirmModal.jsx'
```

Add state alongside the other `useState` calls near the top of the component:

```jsx
const [confirmDeleteId, setConfirmDeleteId] = useState(null)
```

Replace both Delete button `onClick` handlers (one in active topics, one in archived topics) from:

```jsx
onClick={() => { onDeleteTopic?.(t.id); setOpenMenuId(null) }}
```

to:

```jsx
onClick={() => { setConfirmDeleteId(t.id); setOpenMenuId(null) }}
```

Add the confirm modal just before the closing `</nav>`:

```jsx
      {confirmDeleteId && (
        <ConfirmModal
          message={`Permanently delete this topic and move all its entries to trash?`}
          confirmLabel="Delete"
          onConfirm={() => { onDeleteTopic?.(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </nav>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/components/TopicList.test.jsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopicList.jsx src/components/TopicList.test.jsx
git commit -m "feat: confirm dialog before topic delete"
```

---

### Task 5: DB length constraints on notes and topic names

**Files:**
- Create: `supabase/migrations/0020_length_constraints.sql`

**Context:** The `note` column on `entries` and `name` column on `topics` have no DB-level length cap. A buggy client or runaway script could insert a 100 MB note and exhaust your Supabase storage quota. The topic `name` already has `maxLength={120}` in the UI but nothing enforces it in the DB. The `note` field is a markdown editor — 100,000 characters (≈70 pages) is a generous but enforceable cap.

- [ ] **Step 1: Create migration**

Create `supabase/migrations/0020_length_constraints.sql`:

```sql
-- Enforce sane length limits that the UI already implies.
alter table topics
  add constraint topic_name_length
  check (char_length(name) <= 120);

alter table entries
  add constraint entry_note_length
  check (char_length(note) <= 100000);

alter table entries
  add constraint entry_title_length
  check (title is null or char_length(title) <= 500);

alter table entries
  add constraint entry_url_length
  check (url is null or char_length(url) <= 2048);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: `Applying migration 0020_length_constraints.sql` with no errors. If you get a constraint violation, there's existing data that's too long — query it with:
```sql
select id, char_length(note) from entries where char_length(note) > 100000;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0020_length_constraints.sql
git commit -m "security: DB length constraints on note, title, url, topic name"
```

---

### Task 6: Private attachments bucket with signed URLs

**Files:**
- Create: `supabase/migrations/0021_private_attachments.sql`
- Modify: `src/lib/storage.js`
- Modify: `src/components/FilesView.jsx`

**Context:** The `attachments` storage bucket is `public: true`, meaning any file is accessible by its URL with no auth — useful for images embedded in markdown notes, but means PDFs with personal notes are also world-readable. The fix: make the bucket private and replace all `getPublicUrl` calls with `createSignedUrl` (1-hour expiry for FilesView, 7-day for note-embedded images so they don't expire mid-session).

**Important:** URLs stored in markdown notes (e.g. `![alt](https://...supabase.co/storage/v1/object/public/...)`) will break when the bucket goes private. After this migration, those embedded URLs become dead. You'll need to re-upload any existing attachments or manually resign them. For a fresh setup this is fine; for existing notes, do this before accumulating lots of attachments.

- [ ] **Step 1: Create migration**

Create `supabase/migrations/0021_private_attachments.sql`:

```sql
-- Switch attachments bucket to private; all access goes through signed URLs.
update storage.buckets set public = false where id = 'attachments';
```

- [ ] **Step 2: Update `src/lib/storage.js` — replace `getPublicUrl` with signed URL**

Replace the two `getPublicUrl` calls. Change:

```js
  const { data: origData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = origData.publicUrl
```

to:

```js
  const { data: origData, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7) // 7-day expiry
  if (signErr) throw signErr
  const url = origData.signedUrl
```

And change the thumbnail `getPublicUrl`:

```js
        const { data: thumbData } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath)
        return { url, thumbUrl: thumbData.publicUrl }
```

to:

```js
        const { data: thumbData } = await supabase.storage
          .from(BUCKET).createSignedUrl(thumbPath, 60 * 60 * 24 * 7)
        return { url, thumbUrl: thumbData?.signedUrl ?? null }
```

- [ ] **Step 3: Update `src/components/FilesView.jsx` — replace `getPublicUrl` with signed URL**

Replace the `getPublicUrl` function:

```jsx
  function getPublicUrl(file) {
    return supabase.storage.from('attachments').getPublicUrl(`${userId}/${file.name}`).data.publicUrl
  }
```

with an async signed URL fetch. Add a `fileUrls` state:

```jsx
  const [fileUrls, setFileUrls] = useState({})

  async function signUrl(fileName) {
    const { data } = await supabase.storage
      .from('attachments')
      .createSignedUrl(`${userId}/${fileName}`, 60 * 60) // 1-hour for file browser
    return data?.signedUrl ?? null
  }
```

Update the `loadFiles` function to sign URLs after listing:

```jsx
  async function loadFiles() {
    setLoading(true)
    const { data } = await supabase.storage.from('attachments').list(userId)
    setFiles(data || [])
    const urls = {}
    for (const f of data || []) {
      urls[f.name] = await signUrl(f.name)
    }
    setFileUrls(urls)
    setLoading(false)
  }
```

Replace `publicUrl={getPublicUrl(file)}` in the JSX with `publicUrl={fileUrls[file.name] ?? ''}`.

- [ ] **Step 4: Apply migration and test**

```bash
npx supabase db push
```

Open the app, upload a new file, confirm it displays in FilesView. Open an existing note with an embedded image — if the image shows as broken, those old URLs stored in markdown need to be re-signed manually (see Context note above).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0021_private_attachments.sql src/lib/storage.js src/components/FilesView.jsx
git commit -m "security: private attachments bucket, replace getPublicUrl with signed URLs"
```

---

## Post-Plan Notes

**Deferred (not blocking ship for personal use):**
- Per-user rate limiting on `enrich` — unnecessary after JWT auth limits calls to authenticated users only
- `dangerouslySetInnerHTML` in `SettingsView` — static string, not exploitable; move to CSS when convenient
- `opportunities` RLS `using (true)` — intentional (public job data); document it and move on
- Long-expiry signed URLs in embedded markdown — existing notes will have broken images after Task 6; acceptable for personal use, fix by adding a re-sign migration if needed

**Manual steps not in migrations (do once in Supabase dashboard or SQL editor):**
```sql
-- After Task 2: set the cron secret as a postgres config
alter database postgres set app.cron_secret = '<your-cron-secret>';
```
