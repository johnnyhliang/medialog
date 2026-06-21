# Instagram Reels Ingestion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-ingest Instagram Reels into medialog by DMing a reel link to a configured alt account, polling that inbox via a scheduled edge function, and creating a summarized entry in a "Reels" topic.

**Architecture:** A new `fetch-reels` Supabase Edge Function (Deno, pg_cron scheduled) polls the Instagram private API for DM threads on the alt account, extracts reel URLs, fetches caption + metadata, calls Claude Haiku for a 2-sentence summary, and upserts an entry into the `entries` table under a reserved "Reels" topic. Duplicate prevention via `source_url` uniqueness check. No video download in v1 — caption-based summarization only.

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron + pg_net, Claude Haiku (`claude-haiku-4-5-20251001`), Instagram private API (session cookie auth), Supabase JS v2

## Pre-requisites / Secrets Needed

| Secret | How to get |
|---|---|
| `INSTAGRAM_SESSION_ID` | DevTools → instagram.com → Application → Cookies → `sessionid` value |
| `ANTHROPIC_API_KEY` | anthropic.com console |
| `CRON_SECRET` | Already set up (see main TODO) |

## Global Constraints

- Edge function name: `fetch-reels`
- Uses existing `entries` table — no new migrations for entries
- New migration needed: ensure a "Reels" system topic exists per user (or create on first run)
- Instagram API base: `https://www.instagram.com/api/v1/` (private, session-cookie auth)
- DM inbox endpoint: `direct_v2/inbox/?visual_media_check_pending=false&thread_message_limit=10`
- Summarization model: `claude-haiku-4-5-20251001`
- CRON schedule: every 15 minutes (`*/15 * * * *`)
- Guard with `CRON_SECRET` header (same pattern as `fetch-opportunities`)
- Entry `source_url` = reel permalink; skip if already exists in DB

## ⚠️ Risk Note

Instagram's private API is undocumented and session-based. It may break without notice, change endpoints, or require extra headers (User-Agent spoofing). The session cookie expires — plan for re-auth. Build with graceful failure: log errors but don't crash the function.

---

### Task 1: Instagram API wrapper

**Files:**
- Create: `supabase/functions/fetch-reels/instagram.ts`
- (No test file — Deno edge function, test manually via curl after deploy)

**Goal:** Functions to fetch DM inbox and extract reel URLs + captions.

- [ ] **Step 1: Create `instagram.ts`**

```typescript
const IG_BASE = 'https://www.instagram.com/api/v1'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'X-IG-App-ID': '936619743392459',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
}

export interface ReelItem {
  reelUrl: string       // e.g. https://www.instagram.com/reel/SHORTCODE/
  caption: string
  mediaType: 'reel' | 'video'
}

export async function fetchInboxReels(sessionId: string): Promise<ReelItem[]> {
  const res = await fetch(
    `${IG_BASE}/direct_v2/inbox/?visual_media_check_pending=false&thread_message_limit=20`,
    {
      headers: {
        ...DEFAULT_HEADERS,
        Cookie: `sessionid=${sessionId}`,
      },
    }
  )
  if (!res.ok) throw new Error(`Instagram inbox fetch failed: ${res.status}`)
  const data = await res.json()
  const threads: unknown[] = data?.inbox?.threads ?? []
  const items: ReelItem[] = []
  for (const thread of threads) {
    const messages: unknown[] = (thread as Record<string, unknown>)?.items as unknown[] ?? []
    for (const msg of messages) {
      const m = msg as Record<string, unknown>
      // Reels come through as link items or clip items
      const link = (m.link as Record<string, unknown> | undefined)
      const clip = (m.clip as Record<string, unknown> | undefined)
      if (link?.link_context) {
        const lc = link.link_context as Record<string, unknown>
        const url = lc.link_url as string | undefined
        if (url?.includes('/reel/') || url?.includes('/p/')) {
          items.push({ reelUrl: url, caption: (lc.link_title as string) ?? '', mediaType: 'reel' })
        }
      } else if (clip) {
        const media = (clip as Record<string, unknown>).clip as Record<string, unknown>
        const code = media?.code as string | undefined
        const caption = ((media?.caption as Record<string, unknown>)?.text as string) ?? ''
        if (code) items.push({ reelUrl: `https://www.instagram.com/reel/${code}/`, caption, mediaType: 'reel' })
      }
    }
  }
  return items
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fetch-reels/instagram.ts
git commit -m "feat: Instagram DM inbox reel extractor"
```

---

### Task 2: Summarization helper

**Files:**
- Create: `supabase/functions/fetch-reels/summarize.ts`

- [ ] **Step 1: Create `summarize.ts`**

```typescript
export async function summarizeReel(caption: string, anthropicKey: string): Promise<string> {
  if (!caption.trim()) return ''
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Summarize this Instagram reel caption in 1-2 sentences, focusing on the key idea or takeaway:\n\n${caption.slice(0, 2000)}`,
      }],
    }),
  })
  if (!res.ok) return caption.slice(0, 300)
  const data = await res.json()
  return data?.content?.[0]?.text ?? caption.slice(0, 300)
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fetch-reels/summarize.ts
git commit -m "feat: Claude Haiku reel caption summarizer"
```

---

### Task 3: Main edge function + DB upsert

**Files:**
- Create: `supabase/functions/fetch-reels/index.ts`
- Create: `supabase/migrations/0025_reels_topic.sql`

- [ ] **Step 1: Create migration to ensure Reels topic per user**

`supabase/migrations/0025_reels_topic.sql` — this is a stored function called on first reel insert rather than a static row, because users are dynamic:

```sql
-- Helper: ensure a 'Reels' topic exists for a user, return its id
create or replace function ensure_reels_topic(p_user_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  select id into v_id from topics where user_id = p_user_id and name = 'Reels' limit 1;
  if v_id is null then
    insert into topics (user_id, name) values (p_user_id, 'Reels') returning id into v_id;
  end if;
  return v_id;
end;
$$;
```

- [ ] **Step 2: Create `index.ts`**

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { fetchInboxReels } from './instagram.ts'
import { summarizeReel } from './summarize.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    if (req.headers.get('X-Cron-Secret') !== cronSecret) {
      return json({ error: 'forbidden' }, 403)
    }
  }

  const sessionId = Deno.env.get('INSTAGRAM_SESSION_ID')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!sessionId) return json({ error: 'INSTAGRAM_SESSION_ID not set' }, 500)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get all users who have a Reels topic (opt-in: they must exist)
  // For a personal tool, just use service role to insert for the single user
  // Get user from a config table or env var
  const ownerId = Deno.env.get('CAPTURE_USER_ID')
  if (!ownerId) return json({ error: 'CAPTURE_USER_ID not set' }, 500)

  let reels
  try {
    reels = await fetchInboxReels(sessionId)
  } catch (e) {
    console.error('Instagram fetch failed:', e)
    return json({ error: 'instagram_fetch_failed', detail: String(e) }, 500)
  }

  const { data: topicId } = await sb.rpc('ensure_reels_topic', { p_user_id: ownerId })

  let inserted = 0
  for (const reel of reels) {
    // Skip duplicates
    const { data: existing } = await sb
      .from('entries')
      .select('id')
      .eq('user_id', ownerId)
      .eq('url', reel.reelUrl)
      .maybeSingle()
    if (existing) continue

    const note = anthropicKey ? await summarizeReel(reel.caption, anthropicKey) : reel.caption.slice(0, 300)

    await sb.from('entries').insert({
      user_id: ownerId,
      topic_id: topicId,
      url: reel.reelUrl,
      title: 'Instagram Reel',
      note,
      status: 'inbox',
    })
    inserted++
  }

  return json({ processed: reels.length, inserted })
})
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/fetch-reels/index.ts supabase/migrations/0025_reels_topic.sql
git commit -m "feat: fetch-reels edge function — poll DM inbox, summarize, upsert entries"
```

---

### Task 4: Schedule + secrets setup

**Files:**
- Create: `supabase/migrations/0026_reels_cron.sql`

- [ ] **Step 1: Create cron migration**

`supabase/migrations/0026_reels_cron.sql`:

```sql
select cron.unschedule('fetch-reels') where exists (
  select 1 from cron.job where jobname = 'fetch-reels'
);

select cron.schedule(
  'fetch-reels',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/fetch-reels',
    headers := format('{"Content-Type": "application/json", "X-Cron-Secret": "%s"}',
      current_setting('app.cron_secret', true))::jsonb,
    body := '{}'::jsonb
  )
  $$
);
```

- [ ] **Step 2: Deploy and configure**

```bash
# Deploy function
npx supabase functions deploy fetch-reels

# Set secrets (get sessionid from instagram.com DevTools → Cookies)
npx supabase secrets set INSTAGRAM_SESSION_ID=<your-sessionid>
npx supabase secrets set ANTHROPIC_API_KEY=<your-key>

# Set your user ID (find it in Supabase Auth dashboard)
npx supabase secrets set CAPTURE_USER_ID=<your-uuid>

# Apply migrations
npx supabase db push
```

- [ ] **Step 3: Test manually**

```bash
# Call the function with your cron secret to verify
curl -X POST https://<your-project>.supabase.co/functions/v1/fetch-reels \
  -H "X-Cron-Secret: <your-secret>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response: `{"processed": N, "inserted": M}`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0026_reels_cron.sql
git commit -m "feat: schedule fetch-reels every 15 minutes via pg_cron"
```

---

## Known Limitations / v2 Ideas

- **Session expiry:** `INSTAGRAM_SESSION_ID` expires. When it does, the function returns 403 from Instagram and logs it — you'll need to re-set the secret from DevTools. No auto-renewal in v1.
- **Video transcription:** v2 could download the reel audio, send to Whisper for transcription, and summarize the transcript instead of just the caption.
- **Multi-user:** Currently hardcoded to `CAPTURE_USER_ID`. v2 could store per-user Instagram sessions in a `user_integrations` table.
- **DM cleanup:** Doesn't delete/mark DMs as read after processing — you'll accumulate read reels in your inbox.
