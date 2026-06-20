# Opportunity Radar — Backend Implementation Plan (Agent A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the DB schema, seed data, and two Supabase edge functions that fetch opportunities from HN, ATS career pages, GitHub trending, and Twitter — storing results in Postgres for the frontend widget to read.

**Architecture:** Two edge functions (`fetch-opportunities`, `fetch-programs`) triggered hourly/daily via pg_cron. Each function is a Deno module with sub-modules per source. All results upsert into three new tables. No auth required except a Twitter session cookie stored as a Supabase secret.

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron, PostgreSQL, `@supabase/supabase-js` v2

## Global Constraints

- Runtime: Deno — use `import` not `require`; use native `fetch`
- Edge function entry: `serve()` from `https://deno.land/std@0.168.0/http/server.ts`
- Supabase client: `createClient` from `https://esm.sh/@supabase/supabase-js@2`
- No secrets except `TWITTER_AUTH_TOKEN` (optional — function degrades gracefully if absent)
- All upserts use `onConflict: 'source,url'` — never create duplicates
- Role filter applied in index.ts before upsert — github source skips role filter
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the runtime

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0012_opportunities.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0012_opportunities.sql

-- Opportunities: fetched from all sources, deduped by (source, url)
create table opportunities (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  company     text,
  title       text not null,
  body        text,
  url         text not null,
  author      text,
  posted_at   timestamptz,
  fetched_at  timestamptz not null default now(),
  tags        text[],
  is_read     boolean not null default false,
  is_saved    boolean not null default false,
  unique (source, url)
);
alter table opportunities enable row level security;
create policy "own opportunities" on opportunities for all using (true);
create index on opportunities (posted_at desc);
create index on opportunities (is_read, posted_at desc);

-- Programs: fellowship/internship-track programs with deadline tracking
create table programs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  url           text not null,
  category      text,
  company       text,
  deadline      date,
  window_open   boolean not null default false,
  notes         text,
  last_checked  timestamptz
);
alter table programs enable row level security;
create policy "own programs" on programs for all using (true);

-- Applications: user's job application pipeline
create table applications (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid references opportunities(id) on delete set null,
  company         text not null,
  role            text not null,
  url             text,
  status          text not null default 'saved'
                  check (status in ('saved','applied','screen','interview','offer','rejected','ghosted')),
  applied_at      date,
  deadline        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table applications enable row level security;
create policy "own applications" on applications for all using (true);
create index on applications (status, created_at desc);
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Open Supabase Dashboard → SQL Editor → paste file contents → Run.
Expected: "Success. No rows returned." Verify three new tables appear in Table Editor: `opportunities`, `programs`, `applications`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_opportunities.sql
git commit -m "feat: add opportunities, programs, applications tables"
```

---

## Task 2: Seed programs table

**Files:**
- Create: `supabase/migrations/0013_seed_programs.sql`

- [ ] **Step 1: Create seed file**

```sql
-- supabase/migrations/0013_seed_programs.sql
insert into programs (name, url, category, company, notes) values
  ('Jane Street FOCUS', 'https://www.janestreet.com/join-jane-street/programs-and-events/focus/', 'internship-track', 'Jane Street', 'apps open ~Oct annually'),
  ('HRT Explore', 'https://www.hudsonrivertrading.com/hrtx/', 'internship-track', 'Hudson River Trading', 'apps open ~Sep annually'),
  ('Citadel Datathon', 'https://www.citadel.com/careers/students/datathons/', 'program', 'Citadel', 'rolling'),
  ('8VC Fellowship', 'https://www.8vc.com/fellowship', 'fellowship', '8VC', 'apps ~Jan/Sep'),
  ('Afore Fellowship', 'https://afore.vc/fellowship', 'fellowship', 'Afore Capital', 'rolling'),
  ('Contrary Capital', 'https://contrarycap.com/talent', 'fellowship', 'Contrary', 'rolling'),
  ('Pear VC Fellowship', 'https://pear.vc/fellowship', 'fellowship', 'Pear VC', 'rolling'),
  ('YC Startup School', 'https://www.startupschool.org/', 'startup', 'Y Combinator', 'rolling cohorts'),
  ('Neo Scholars', 'https://neo.com/scholars', 'program', 'Neo', 'apps ~Sep annually'),
  ('On Deck', 'https://www.beondeck.com/', 'program', 'On Deck', 'rolling cohorts'),
  ('Google Student Researcher', 'https://careers.google.com/jobs/results/?category=RESEARCH&employment_type=INTERN', 'internship-track', 'Google', 'rolling'),
  ('Google STEP Intern', 'https://buildyourfuture.withgoogle.com/programs/step', 'internship-track', 'Google', 'apps ~Oct annually'),
  ('Meta University', 'https://www.metacareers.com/careerprograms/pathways/metauniversity', 'internship-track', 'Meta', 'apps ~Oct annually'),
  ('Microsoft Explore', 'https://careers.microsoft.com/students/us/en/usexploremicrosoftprogram', 'internship-track', 'Microsoft', 'apps ~Oct annually')
on conflict (name) do nothing;
```

- [ ] **Step 2: Apply in Supabase dashboard SQL Editor**

Expected: 14 rows inserted. Verify with: `select name, category from programs order by name;`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0013_seed_programs.sql
git commit -m "feat: seed programs table with 14 fellowship and internship-track programs"
```

---

## Task 3: `fetch-opportunities` — HN module

**Files:**
- Create: `supabase/functions/fetch-opportunities/hn.ts`

**Interfaces:**
- Produces: `fetchHN() => Promise<Opportunity[]>` where `Opportunity` is the shared type defined in this file and re-used across all source modules

- [ ] **Step 1: Create `supabase/functions/fetch-opportunities/hn.ts`**

```typescript
export type Opportunity = {
  source: string
  company: string | null
  title: string
  body: string | null
  url: string
  author: string | null
  posted_at: string | null
  tags: string[]
}

export async function fetchHN(): Promise<Opportunity[]> {
  const searchRes = await fetch(
    'https://hn.algolia.com/api/v1/search?query=Ask+HN+Who+is+hiring&tags=story,ask_hn&hitsPerPage=1'
  )
  if (!searchRes.ok) return []
  const searchJson = await searchRes.json()
  const threadId = searchJson?.hits?.[0]?.objectID
  if (!threadId) return []

  const threadRes = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${threadId}.json`
  )
  if (!threadRes.ok) return []
  const thread = await threadRes.json()
  if (!thread?.kids?.length) return []

  const commentIds: number[] = thread.kids.slice(0, 100)
  const settled = await Promise.allSettled(
    commentIds.map((id) =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json())
    )
  )

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<any> =>
        r.status === 'fulfilled' && r.value?.text
    )
    .map((r) => {
      const item = r.value
      const text = item.text
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .trim()
      const firstLine = text.split('\n')[0].slice(0, 150)
      const companyMatch = firstLine.match(/^([\w][\w\s,\.]+?)\s*[|\-–]/)
      return {
        source: 'hn',
        company: companyMatch?.[1]?.trim() ?? null,
        title: firstLine,
        body: text.slice(0, 1000),
        url: `https://news.ycombinator.com/item?id=${item.id}`,
        author: item.by ?? null,
        posted_at: item.time ? new Date(item.time * 1000).toISOString() : null,
        tags: ['hn'],
      }
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fetch-opportunities/hn.ts
git commit -m "feat: HN Who's Hiring source module"
```

---

## Task 4: `fetch-opportunities` — careers module (Greenhouse / Lever / Ashby)

**Files:**
- Create: `supabase/functions/fetch-opportunities/careers.ts`

**Interfaces:**
- Consumes: `Opportunity` type from `./hn.ts`
- Produces: `fetchCareers() => Promise<Opportunity[]>`

- [ ] **Step 1: Create `supabase/functions/fetch-opportunities/careers.ts`**

```typescript
import type { Opportunity } from './hn.ts'

type CompanyConfig = {
  slug: string
  name: string
  ats: 'greenhouse' | 'lever' | 'ashby'
  tags?: string[]
}

const COMPANIES: CompanyConfig[] = [
  { slug: 'anthropic', name: 'Anthropic', ats: 'greenhouse', tags: ['ai', 'research'] },
  { slug: 'openai', name: 'OpenAI', ats: 'greenhouse', tags: ['ai', 'research'] },
  { slug: 'cohere', name: 'Cohere', ats: 'greenhouse', tags: ['ai'] },
  { slug: 'mistral', name: 'Mistral', ats: 'ashby', tags: ['ai'] },
  { slug: 'together-ai', name: 'Together AI', ats: 'ashby', tags: ['ai'] },
  { slug: 'perplexity-ai', name: 'Perplexity', ats: 'ashby', tags: ['ai'] },
  { slug: 'stripe', name: 'Stripe', ats: 'greenhouse', tags: ['startup'] },
  { slug: 'linear', name: 'Linear', ats: 'ashby', tags: ['startup'] },
  { slug: 'vercel', name: 'Vercel', ats: 'ashby', tags: ['startup'] },
  { slug: 'anduril', name: 'Anduril', ats: 'greenhouse', tags: ['startup'] },
  { slug: 'figma', name: 'Figma', ats: 'greenhouse', tags: ['startup'] },
  { slug: 'notion', name: 'Notion', ats: 'lever', tags: ['startup'] },
  { slug: 'google', name: 'Google', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'meta', name: 'Meta', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'apple', name: 'Apple', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'amazon-dev-center-u-s', name: 'Amazon', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'microsoft', name: 'Microsoft', ats: 'greenhouse', tags: ['big-tech'] },
  { slug: 'two-sigma', name: 'Two Sigma', ats: 'greenhouse', tags: ['quant'] },
  { slug: 'citadel', name: 'Citadel', ats: 'greenhouse', tags: ['quant'] },
  { slug: 'hudson-river-trading', name: 'HRT', ats: 'ashby', tags: ['quant'] },
  { slug: 'optiver', name: 'Optiver', ats: 'greenhouse', tags: ['quant'] },
]

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
}

async function fetchGreenhouse(c: CompanyConfig): Promise<Opportunity[]> {
  const r = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`
  )
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
  const results = await Promise.allSettled(
    COMPANIES.map((c) => {
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

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fetch-opportunities/careers.ts
git commit -m "feat: Greenhouse/Lever/Ashby careers source module"
```

---

## Task 5: `fetch-opportunities` — Twitter module

**Files:**
- Create: `supabase/functions/fetch-opportunities/twitter.ts`

**Interfaces:**
- Consumes: `Opportunity` type from `./hn.ts`
- Produces: `fetchTwitter() => Promise<Opportunity[]>`
- Reads env: `TWITTER_AUTH_TOKEN` (returns `[]` if absent — graceful degradation)

- [ ] **Step 1: Create `supabase/functions/fetch-opportunities/twitter.ts`**

```typescript
import type { Opportunity } from './hn.ts'

const QUERY = [
  '(hiring OR "google form" OR "forms.gle" OR fellowship OR cohort OR "new grad" OR internship OR opportunity OR "looking for" OR "apply here")',
  '(SWE OR engineer OR quant OR researcher OR software OR data OR ML OR AI OR product OR VC)',
  'lang:en -is:retweet -is:reply',
].join(' ')

function emojiCount(text: string): number {
  return (text.match(/\p{Emoji_Presentation}/gu) ?? []).length
}

function isHighQuality(tweet: any, author: any): boolean {
  if (emojiCount(tweet.text) > 3) return false
  if ((author?.public_metrics?.followers_count ?? 0) < 50) return false
  const createdAt = author?.created_at ? new Date(author.created_at) : null
  if (createdAt) {
    const ageMs = Date.now() - createdAt.getTime()
    if (ageMs < 1000 * 60 * 60 * 24 * 180) return false // account < 6 months old
  }
  const tweetAge = Date.now() - new Date(tweet.created_at).getTime()
  if (tweetAge > 1000 * 60 * 60 * 48) return false // older than 48h
  return true
}

export async function fetchTwitter(): Promise<Opportunity[]> {
  const authToken = Deno.env.get('TWITTER_AUTH_TOKEN')
  if (!authToken) {
    console.warn('TWITTER_AUTH_TOKEN not set — skipping Twitter')
    return []
  }

  const params = new URLSearchParams({
    query: QUERY,
    max_results: '50',
    'tweet.fields': 'created_at,author_id,text',
    expansions: 'author_id',
    'user.fields': 'created_at,public_metrics,username',
  })

  let res: Response
  try {
    res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
      headers: {
        Cookie: `auth_token=${authToken}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'x-twitter-client-language': 'en',
      },
    })
  } catch (e) {
    console.error('Twitter fetch network error:', e)
    return []
  }

  if (res.status === 401) {
    console.error('TWITTER_AUTH_EXPIRED — update TWITTER_AUTH_TOKEN secret')
    return []
  }
  if (!res.ok) {
    console.error(`Twitter fetch failed: ${res.status}`)
    return []
  }

  const json = await res.json()
  const tweets: any[] = json.data ?? []
  const users: Record<string, any> = {}
  for (const u of json.includes?.users ?? []) users[u.id] = u

  return tweets
    .filter((t) => isHighQuality(t, users[t.author_id]))
    .map((t) => {
      const author = users[t.author_id]
      const handle = author?.username ?? null
      return {
        source: 'twitter',
        company: null,
        title: t.text.slice(0, 100),
        body: t.text,
        url: handle ? `https://twitter.com/${handle}/status/${t.id}` : `https://twitter.com/i/web/status/${t.id}`,
        author: handle ? `@${handle}` : null,
        posted_at: t.created_at,
        tags: ['twitter'],
      }
    })
}
```

- [ ] **Step 2: Add `TWITTER_AUTH_TOKEN` to Supabase secrets**

In Supabase Dashboard → Edge Functions → Secrets → Add new secret:
- Name: `TWITTER_AUTH_TOKEN`
- Value: paste your `auth_token` cookie value from Twitter (DevTools → Application → Cookies → twitter.com → `auth_token`)

The function works without it (returns empty array), so this can be done any time.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/fetch-opportunities/twitter.ts
git commit -m "feat: Twitter keyword search source module with quality filters"
```

---

## Task 6: `fetch-opportunities` — GitHub module

**Files:**
- Create: `supabase/functions/fetch-opportunities/github.ts`

**Interfaces:**
- Consumes: `Opportunity` type from `./hn.ts`
- Produces: `fetchGithub() => Promise<Opportunity[]>`

- [ ] **Step 1: Create `supabase/functions/fetch-opportunities/github.ts`**

```typescript
import type { Opportunity } from './hn.ts'

export async function fetchGithub(): Promise<Opportunity[]> {
  try {
    const r = await fetch(
      'https://gh-trending-api.herokuapp.com/repositories?since=daily',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!r.ok) return []
    const repos: any[] = await r.json()
    return repos.slice(0, 10).map((repo) => ({
      source: 'github',
      company: repo.author ?? null,
      title: `${repo.name} — ${repo.description ?? 'trending repo'}`,
      body: repo.description ?? null,
      url: repo.url ?? `https://github.com/${repo.author}/${repo.name}`,
      author: repo.author ?? null,
      posted_at: new Date().toISOString(),
      tags: ['github-trending', repo.language?.toLowerCase()].filter(Boolean) as string[],
    }))
  } catch (e) {
    console.error('GitHub trending fetch error:', e)
    return []
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/fetch-opportunities/github.ts
git commit -m "feat: GitHub trending source module"
```

---

## Task 7: `fetch-opportunities` — index (fan-out + role filter + upsert)

**Files:**
- Create: `supabase/functions/fetch-opportunities/index.ts`

**Interfaces:**
- Consumes: `fetchHN` from `./hn.ts`, `fetchCareers` from `./careers.ts`, `fetchTwitter` from `./twitter.ts`, `fetchGithub` from `./github.ts`

- [ ] **Step 1: Create `supabase/functions/fetch-opportunities/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchHN } from './hn.ts'
import { fetchCareers } from './careers.ts'
import { fetchTwitter } from './twitter.ts'
import { fetchGithub } from './github.ts'
import type { Opportunity } from './hn.ts'

const ROLE_KEYWORDS = [
  'intern', 'internship', 'new grad', 'entry level', 'fellowship', 'cohort',
  'quant', 'research', 'software engineer', 'swe', 'product', 'vc', 'analyst',
  'explore', 'focus', 'step', 'university', 'phd', 'ml', 'ai', 'data',
  'programmer', 'developer', 'engineer', 'hiring', 'opportunity', 'apply',
  'forms.gle', 'google form',
]

function matchesRoleFilter(item: Opportunity): boolean {
  const text = `${item.title} ${item.body ?? ''}`.toLowerCase()
  return ROLE_KEYWORDS.some((k) => text.includes(k))
}

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const [hn, careers, twitter, github] = await Promise.allSettled([
    fetchHN(),
    fetchCareers(),
    fetchTwitter(),
    fetchGithub(),
  ])

  const all: Opportunity[] = [
    ...(hn.status === 'fulfilled' ? hn.value : []),
    ...(careers.status === 'fulfilled' ? careers.value : []),
    ...(twitter.status === 'fulfilled' ? twitter.value : []),
    ...(github.status === 'fulfilled' ? github.value : []),
  ]

  // GitHub skips role filter — it's a weak signal source, we want all trending repos
  const filtered = all.filter(
    (item) => item.source === 'github' || matchesRoleFilter(item)
  )

  let inserted = 0
  if (filtered.length > 0) {
    const { error, count } = await supabase
      .from('opportunities')
      .upsert(filtered, { onConflict: 'source,url', ignoreDuplicates: true, count: 'exact' })
    if (error) console.error('upsert error:', error)
    else inserted = count ?? 0
  }

  const sourceCounts = {
    hn: hn.status === 'fulfilled' ? hn.value.length : 'error',
    careers: careers.status === 'fulfilled' ? careers.value.length : 'error',
    twitter: twitter.status === 'fulfilled' ? twitter.value.length : 'error',
    github: github.status === 'fulfilled' ? github.value.length : 'error',
  }

  return new Response(
    JSON.stringify({ fetched: all.length, filtered: filtered.length, inserted, sources: sourceCounts }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

- [ ] **Step 2: Deploy the function**

```bash
supabase functions deploy fetch-opportunities
```

Expected: "Deployed Functions on project ... : fetch-opportunities"

- [ ] **Step 3: Smoke test — invoke manually**

In Supabase Dashboard → Edge Functions → fetch-opportunities → Test:
```json
{}
```
Expected response: `{ "fetched": N, "filtered": M, "inserted": K, "sources": {...} }`
Verify rows appear in Table Editor → opportunities.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/fetch-opportunities/index.ts
git commit -m "feat: fetch-opportunities edge function — fan-out, role filter, upsert"
```

---

## Task 8: `fetch-programs` edge function

**Files:**
- Create: `supabase/functions/fetch-programs/index.ts`

- [ ] **Step 1: Create `supabase/functions/fetch-programs/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPEN_PATTERNS = [
  /apply now/i,
  /applications\s+(are\s+)?open/i,
  /forms\.gle/i,
  /now accepting/i,
  /submit your application/i,
]

const DEADLINE_PATTERN = /deadline[:\s]+(\w+ \d+,?\s*\d{4})/i

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: programs, error } = await supabase.from('programs').select('*')
  if (error || !programs?.length) {
    return new Response(JSON.stringify({ error: error?.message ?? 'no programs' }), { status: 200 })
  }

  const results: { name: string; window_open: boolean; deadline: string | null }[] = []

  for (const program of programs) {
    try {
      const r = await fetch(program.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      })
      if (!r.ok) continue
      const text = await r.text()
      const wasOpen: boolean = program.window_open
      const isOpen = OPEN_PATTERNS.some((p) => p.test(text))
      const deadlineMatch = text.match(DEADLINE_PATTERN)
      const deadline: string | null = deadlineMatch
        ? (() => {
            try { return new Date(deadlineMatch[1]).toISOString().split('T')[0] }
            catch { return program.deadline }
          })()
        : program.deadline

      await supabase
        .from('programs')
        .update({ window_open: isOpen, deadline, last_checked: new Date().toISOString() })
        .eq('id', program.id)

      // Insert synthetic opportunity when window flips open
      if (isOpen && !wasOpen) {
        await supabase.from('opportunities').upsert(
          {
            source: 'program-alert',
            company: program.company,
            title: `${program.name} — applications open`,
            body: program.notes ?? null,
            url: program.url,
            author: null,
            posted_at: new Date().toISOString(),
            tags: ['program-alert', program.category ?? 'program'],
          },
          { onConflict: 'source,url', ignoreDuplicates: false }
        )
      }

      results.push({ name: program.name, window_open: isOpen, deadline })
    } catch (e) {
      console.error(`fetch-programs error for ${program.name}:`, e)
    }
  }

  return new Response(JSON.stringify({ checked: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy fetch-programs
```

- [ ] **Step 3: Smoke test**

Invoke from Supabase Dashboard → Edge Functions → fetch-programs → Test with `{}`.
Expected: `{ "checked": 14, "results": [...] }` — each program checked, `window_open` updated.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/fetch-programs/index.ts
git commit -m "feat: fetch-programs edge function — deadline detection, alert on window open"
```

---

## Task 9: pg_cron schedules

**Files:**
- Create: `supabase/migrations/0014_cron_jobs.sql`

- [ ] **Step 1: Create migration**

```sql
-- supabase/migrations/0014_cron_jobs.sql
-- Requires pg_cron extension (enabled by default in Supabase)

select cron.schedule(
  'fetch-opportunities-hourly',
  '0 * * * *',   -- every hour at :00
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/fetch-opportunities',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

select cron.schedule(
  'fetch-programs-daily',
  '0 8 * * *',   -- every day at 8am UTC
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/fetch-programs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
```

- [ ] **Step 2: Apply in Supabase Dashboard SQL Editor**

Expected: "Success." Verify with:
```sql
select jobname, schedule, active from cron.job;
```
Should show two rows: `fetch-opportunities-hourly` and `fetch-programs-daily`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0014_cron_jobs.sql
git commit -m "feat: pg_cron schedules for hourly opportunity fetch and daily program check"
```

---

## Backend Done Criteria

- `opportunities`, `programs`, `applications` tables exist with RLS enabled
- `programs` table seeded with 14 rows
- `supabase functions deploy fetch-opportunities` and `supabase functions deploy fetch-programs` both succeed
- Manual invoke of `fetch-opportunities` returns `{ fetched: N, filtered: M }` with N > 0
- Manual invoke of `fetch-programs` returns `{ checked: 14 }`
- pg_cron shows two active jobs
- `opportunities` table has rows after first run
