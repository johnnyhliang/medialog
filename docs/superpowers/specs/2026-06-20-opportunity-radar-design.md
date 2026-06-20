# Opportunity Radar — Design Spec

**Date:** 2026-06-20
**Status:** Approved

---

## Goal

Add an Opportunity Radar to the MediaLog dashboard that surfaces high-signal job listings, fellowships, and niche posts from public sources and Twitter — replacing the impulse to open LinkedIn or Twitter. Pulls from HN Who's Hiring, Greenhouse/Lever/Ashby ATS feeds, Twitter keyword search, and known fellowship/program pages. Deadline alerts fire prominently when application windows open. Manual submission lets you save anything you find elsewhere. An application tracker lets you follow through on what you save.

---

## Architecture

**Supabase-native. No new infrastructure.**

Three scheduled edge functions (pg_cron) write into three new tables. The dashboard widget reads from those tables via the existing supabase client prop. Twitter uses your session cookie stored as a Supabase secret.

```
pg_cron (hourly)  → fetch-opportunities edge function
                       ├── hn.ts          (Algolia API, public)
                       ├── careers.ts     (Greenhouse / Lever / Ashby, public)
                       ├── github.ts      (trending repos, weak signal, public)
                       └── twitter.ts     (session cookie, keyword search)

pg_cron (daily)   → fetch-programs edge function
                       └── programs.ts    (fellowship/program pages, deadline parsing)

Dashboard
  └── WidgetPanel
        ├── DeadlineAlertBanner      (above everything when window is open)
        └── OpportunitiesWidget
              ├── filter pills + manual submit form
              ├── opportunity rows
              └── [tracked] application status rows

App
  └── view === 'applications'  →  ApplicationsView  (full-page tracker)
```

---

## Data Model

### `opportunities` table

```sql
create table opportunities (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,       -- 'hn', 'greenhouse', 'lever', 'ashby', 'github', 'twitter', 'manual'
  company     text,
  title       text not null,
  body        text,                -- snippet, HN comment, tweet text, or description
  url         text not null,
  author      text,                -- twitter handle or HN username
  posted_at   timestamptz,
  fetched_at  timestamptz not null default now(),
  tags        text[],              -- ['swe','quant','fellowship','internship','remote','research']
  is_read     boolean not null default false,
  is_saved    boolean not null default false,
  unique (source, url)
);

alter table opportunities enable row level security;
create policy "own opportunities" on opportunities for all using (true);
create index on opportunities (posted_at desc);
create index on opportunities (is_read, posted_at desc);
```

### `programs` table

```sql
create table programs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  url           text not null,
  category      text,             -- 'fellowship', 'program', 'internship-track', 'startup'
  company       text,
  deadline      date,             -- null = not yet announced
  window_open   boolean not null default false,
  notes         text,             -- e.g. "opens mid-September annually"
  last_checked  timestamptz
);
```

### `applications` table

```sql
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

---

## Edge Functions

### `fetch-opportunities` (hourly via pg_cron)

Fans out to four source modules, applies role filter, upserts results. Items not matching any role keyword are dropped before insert.

**Role filter keywords** (title + body, case-insensitive):
`intern`, `internship`, `new grad`, `entry level`, `fellowship`, `cohort`, `quant`, `research`, `software engineer`, `swe`, `product`, `vc`, `analyst`, `explore`, `focus`, `step`, `university`, `phd`, `ml`, `ai`, `data`, `programmer`, `developer`, `engineer`, `hiring`, `opportunity`, `apply`, `forms.gle`, `google form`

#### `hn.ts` — HN Who's Hiring

- Find current month's thread: `https://hn.algolia.com/api/v1/search?query=Ask+HN+Who+is+hiring&tags=story,ask_hn&hitsPerPage=1`
- Fetch top-level comments via Firebase API
- Map comment → `{ source: 'hn', company, title: first line, body: comment, url: HN item URL, posted_at }`
- Company extracted from first line: `^(\w[\w\s]+?)\s*[|\-–]`

#### `careers.ts` — ATS feeds

Three generic fetchers, one config array. Adding a company = one line.

```ts
type CompanyConfig = {
  slug: string
  name: string
  ats: 'greenhouse' | 'lever' | 'ashby'
  tags?: string[]
}
```

- **Greenhouse:** `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`
- **Lever:** `https://api.lever.co/v0/postings/{slug}?mode=json`
- **Ashby:** `https://api.ashbyhq.com/posting-api/job-board/{slug}`

#### `github.ts` — GitHub Trending (weak signal)

- `https://gh-trending-api.herokuapp.com/repositories?since=daily`
- Tag as `['github-trending']`, skip role filter — surface hot repos as startup signals

#### `twitter.ts` — Keyword search (session cookie)

**Auth:** `TWITTER_AUTH_TOKEN` Supabase secret — user pastes their `auth_token` cookie value once. Edge function sends it as a cookie header on all requests to `api.twitter.com`.

**Endpoint:** `https://api.twitter.com/2/tweets/search/recent`

**Query string (built dynamically):**
```
(hiring OR "google form" OR "forms.gle" OR fellowship OR cohort OR "new grad" OR internship OR opportunity OR "looking for" OR "apply here")
(SWE OR engineer OR quant OR researcher OR "software" OR "data" OR "ML" OR "AI" OR "product" OR "VC")
lang:en -is:retweet -is:reply
```

**Quality filters** (applied after fetch, before upsert):
- Account age ≥ 6 months (`created_at` on author object)
- Followers ≥ 50
- Emoji density: reject if >3 emoji characters in tweet text
- No all-caps words >3 in a row
- Not a promoted/ad tweet
- Posted within 48 hours

**Result mapping:** `{ source: 'twitter', company: null, title: tweet text (first 100 chars), body: full tweet, url: tweet URL, author: @handle, posted_at: tweet created_at }`

**Rate limit:** Twitter session allows ~180 search requests/15min. One query per hour is well within limits.

**Token refresh:** if a 401 is returned, set a `TWITTER_AUTH_EXPIRED` flag in Supabase KV / a config row so the widget can surface "reconnect Twitter" prompt to user.

---

### `fetch-programs` (daily via pg_cron)

Reads `programs` table, fetches each URL, detects window status and deadline from page text.

**Detection heuristics:**
- Window open: `/apply now/i`, `/applications.*open/i`, `/forms\.gle/i`
- Deadline: `/deadline[:\s]+(\w+ \d+,?\s*\d{4})/i`

When `window_open` flips false → true: inserts a synthetic `opportunities` row with `source = 'program-alert'` to trigger the banner.

---

## Company & Program Config

### ATS Companies

| Company | ATS | Tags |
|---|---|---|
| Anthropic | greenhouse | ai, research |
| OpenAI | greenhouse | ai, research |
| Cohere | greenhouse | ai |
| Mistral | ashby | ai |
| Together AI | ashby | ai |
| Perplexity | ashby | ai |
| Stripe | greenhouse | startup |
| Linear | ashby | startup |
| Vercel | ashby | startup |
| Anduril | greenhouse | startup |
| Figma | greenhouse | startup |
| Notion | lever | startup |
| Google | greenhouse | big-tech |
| Meta | greenhouse | big-tech |
| Apple | greenhouse | big-tech |
| Amazon | greenhouse | big-tech |
| Microsoft | greenhouse | big-tech |
| Two Sigma | greenhouse | quant |
| Citadel | greenhouse | quant |
| Hudson River Trading | ashby | quant |
| Optiver | greenhouse | quant |

*Jane Street and DE Shaw have custom career pages — fetched via HTML scrape in a dedicated config entry with CSS selectors.*

### Programs

| Program | Category | Notes |
|---|---|---|
| Jane Street FOCUS | internship-track | apps ~Oct annually |
| HRT Explore | internship-track | apps ~Sep annually |
| Citadel Datathon | program | rolling |
| 8VC Fellowship | fellowship | apps ~Jan/Sep |
| Afore Fellowship | fellowship | rolling |
| Contrary Capital | fellowship | rolling |
| Pear VC | fellowship | rolling |
| YC Startup School | startup | rolling |
| Neo Scholars | program | apps ~Sep annually |
| On Deck | program | rolling cohorts |
| Google Student Researcher | internship-track | rolling |
| Google STEP | internship-track | apps ~Oct annually |
| Meta University | internship-track | apps ~Oct annually |
| Microsoft Explore | internship-track | apps ~Oct annually |

---

## Dashboard Components

### `DeadlineAlertBanner.jsx`

Renders above all widgets in WidgetPanel when any program has `window_open = true`.

```
┌──────────────────────────────────────────────┐
│ 🔔  Neo Scholars — applications open     →   │
│     Jane Street FOCUS — deadline Oct 15  →   │
└──────────────────────────────────────────────┘
```

- One row per open program, sorted by deadline ASC
- Each row links to program URL, opens new tab
- Dismiss per-row stored in localStorage (`dismissed_program_{id}`), resets when `window_open` re-triggers
- Amber accent color

### `OpportunitiesWidget.jsx`

Lives in WidgetPanel above MarketNewsWidget.

```
OPPORTUNITIES  [12 new]              [+ add]
──────────────────────────────────────────────
[All] [SWE] [Quant] [Fellowship] [Twitter] [Saved]

●  twitter     @sama — hiring researchers, DM...   1h
●  greenhouse  Anthropic — Research Engineer        2h
●  hn          Stripe | SWE intern, remote ok       5h
★  ashby       Linear — Product Engineer            1d
──────────────────────────────────────────────
   load more
```

- `[+ add]` button opens inline manual submission form (see below)
- Unread dot clears on click
- Bookmark (★) toggles `is_saved`
- "Track →" button on hover opens quick-add to ApplicationsView
- Filter pills: All · SWE · Quant · Fellowship · Twitter · Saved
- Source chip colored by source (see below)
- Empty state: "No new opportunities · last checked Xm ago"
- Per-source error shown inline if a fetcher failed

**Manual submission form** (inline, toggled by `[+ add]`):
```
URL: [________________]  Tags: [SWE ▾]
Note: [_______________________________]
                              [Save]
```
Inserts `{ source: 'manual', url, body: note, tags, title: domain name or pasted title, posted_at: now() }`.

**Source chip colors:**
- `twitter` — sky blue
- `greenhouse` / `lever` / `ashby` — green
- `hn` — orange
- `github` — purple
- `manual` — slate
- `program-alert` — amber

---

## Application Tracker

### In-widget quick-track

Hovering an opportunity row shows "Track →". Clicking opens a small modal pre-filled with company + role + URL, status defaulting to `'applied'`. User confirms → inserts into `applications`.

### `ApplicationsView.jsx` (full-page view)

New nav item "Applications" in sidebar (between Home and Browse).

```
APPLICATIONS

[Saved]  [Applied]  [Screen]  [Interview]  [Offer]  [Rejected]  [Ghosted]

┌─────────────────────────────────────────────────────┐
│  Anthropic  —  Research Engineer          Applied   │
│  Applied Jan 15 · No deadline             [notes ▾] │
├─────────────────────────────────────────────────────┐
│  Jane Street FOCUS                        Screen    │
│  Applied Jan 10 · Deadline Feb 1          [notes ▾] │
└─────────────────────────────────────────────────────┘
```

- Status tabs filter the list
- Click status badge → cycle to next status (saved → applied → screen → interview → offer / rejected / ghosted)
- Notes expand inline
- Delete with confirmation
- Sorted by `updated_at desc` within each status
- Counts per status shown in tab label

### App.jsx additions

- Add `'applications'` to view state
- Add "Applications" nav item with `Briefcase` lucide icon
- Render `<ApplicationsView supabase={supabase} />` when `view === 'applications'`

---

## New Files

```
supabase/functions/fetch-opportunities/index.ts
supabase/functions/fetch-opportunities/hn.ts
supabase/functions/fetch-opportunities/careers.ts
supabase/functions/fetch-opportunities/github.ts
supabase/functions/fetch-opportunities/twitter.ts
supabase/functions/fetch-programs/index.ts
supabase/migrations/0012_opportunities.sql
src/components/widgets/OpportunitiesWidget.jsx
src/components/widgets/OpportunitiesWidget.test.jsx
src/components/widgets/DeadlineAlertBanner.jsx
src/components/ApplicationsView.jsx
src/components/ApplicationsView.test.jsx
```

### Modified Files

```
src/components/WidgetPanel.jsx   — add DeadlineAlertBanner + OpportunitiesWidget
src/App.jsx                      — add 'applications' view + nav item
src/styles.css                   — new widget + tracker styles
```

---

## Twitter Setup (one-time, ~2 min)

1. Open Twitter in browser, open DevTools → Application → Cookies
2. Copy value of `auth_token` cookie
3. In Supabase dashboard → Edge Functions → Secrets → add `TWITTER_AUTH_TOKEN=<value>`
4. Done. Re-paste if the widget shows "reconnect Twitter"

---

## What's Deferred (v2)

- LinkedIn Google Form post scraping (session cookie, same pattern as Twitter)
- Niche mailing list monitoring (CSAILinterest, ML job boards)
- Deadline push/email notifications
- User-configurable company + program lists
- ML ranking / signal weighting per opportunity
