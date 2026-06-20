# Opportunity Radar — Design Spec

**Date:** 2026-06-20
**Status:** Approved

---

## Goal

Add an Opportunity Radar to the MediaLog dashboard that surfaces high-signal job listings, fellowships, and programs from public sources — replacing the impulse to open LinkedIn or Twitter. Pulls from HN Who's Hiring, Greenhouse/Lever/Ashby ATS feeds, and known fellowship/program pages. Deadline alerts fire prominently when application windows open.

---

## Architecture

**Supabase-native. No new infrastructure.**

Two scheduled edge functions (pg_cron) write into two new tables. The dashboard widget reads from those tables via the existing supabase client prop. All sources are public — no session cookies, no auth risk.

```
pg_cron (hourly)  → fetch-opportunities edge function
                       ├── hn.ts          (Algolia API)
                       ├── careers.ts     (Greenhouse / Lever / Ashby configs)
                       └── github.ts      (trending repos, weak signal)

pg_cron (daily)   → fetch-programs edge function
                       └── programs.ts    (fellowship/program pages, deadline parsing)

Dashboard
  └── WidgetPanel
        ├── DeadlineAlertBanner   (above everything when window is open)
        └── OpportunitiesWidget   (above MarketNewsWidget)
```

---

## Data Model

### `opportunities` table

```sql
create table opportunities (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,       -- 'hn', 'greenhouse', 'lever', 'ashby', 'github'
  company     text,
  title       text not null,
  body        text,                -- snippet, HN comment, or description
  url         text not null,
  posted_at   timestamptz,
  fetched_at  timestamptz not null default now(),
  tags        text[],              -- ['swe','quant','fellowship','internship','remote','research']
  is_read     boolean not null default false,
  is_saved    boolean not null default false,
  unique (source, url)
);

alter table opportunities enable row level security;
create policy "own opportunities" on opportunities
  for all using (true);           -- single-user app, no user_id needed

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

---

## Edge Functions

### `fetch-opportunities` (hourly via pg_cron)

Entry point fans out to three source modules, upserts results. A role filter runs on every item before insert — items not matching any keyword are dropped.

**Role filter keywords** (title + body, case-insensitive):
`intern`, `internship`, `new grad`, `entry level`, `fellowship`, `cohort`, `quant`, `research`, `software engineer`, `swe`, `product`, `vc`, `analyst`, `explore`, `focus`, `step`, `university`, `phd`, `ml`, `ai`

#### `hn.ts` — HN Who's Hiring

- Fetch current month's "Ask HN: Who is Hiring?" thread ID via Algolia: `https://hn.algolia.com/api/v1/search?query=Ask+HN+Who+is+hiring&tags=story,ask_hn&hitsPerPage=1`
- Fetch top-level comments: `https://hacker-news.firebaseio.com/v0/item/{id}.json` then each child
- Map each comment → `{ source: 'hn', company: extracted, title: first line, body: comment text, url: HN item URL, posted_at }`
- Company extracted from first line via regex: `^(\w[\w\s]+?)\s*[|\-–]`

#### `careers.ts` — ATS feeds

Three generic fetchers keyed by ATS type. Adding a new company = one line in the config array.

```ts
type CompanyConfig = {
  slug: string        // ATS identifier
  name: string        // display name
  ats: 'greenhouse' | 'lever' | 'ashby'
  tags?: string[]     // extra tags to attach
}
```

**Greenhouse:** `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`
Returns `{ jobs: [{ title, absolute_url, content, updated_at }] }`

**Lever:** `https://api.lever.co/v0/postings/{slug}?mode=json`
Returns array of `{ text, hostedUrl, createdAt, description }`

**Ashby:** `https://api.ashbyhq.com/posting-api/job-board/{slug}`
Returns `{ jobPostings: [{ title, jobUrl, publishedDate, descriptionHtml }] }`

#### `github.ts` — GitHub Trending (weak signal)

- `https://gh-trending-api.herokuapp.com/repositories?language=&since=daily` (public, no auth)
- Extract repo name, description, language, URL
- Tag as `['github-trending']`, skip role filter
- Useful for finding hot new startups before they post jobs

---

### `fetch-programs` (daily via pg_cron)

Reads the `programs` table, visits each URL, attempts to detect whether the application window is open (looks for "apply now", "applications open", form links, deadline dates in page text). Updates `window_open` and `deadline` fields.

Detection heuristics (regex on page text):
- Window open: `/apply now/i`, `/applications.*open/i`, `/forms\.gle/i`, `/deadline.*\d{4}/i`
- Deadline: `/deadline[:\s]+(\w+ \d+,?\s*\d{4})/i`

When `window_open` flips from false → true, insert a synthetic opportunity row with `source = 'program-alert'` so the banner triggers.

---

## Company & Program Config

### ATS Companies (initial set)

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
| Anduril | greenhouse | startup, defense |
| Figma | greenhouse | startup |
| Notion | lever | startup |
| Google | greenhouse | big-tech |
| Meta | greenhouse | big-tech |
| Apple | greenhouse | big-tech |
| Amazon | greenhouse | big-tech |
| Microsoft | greenhouse | big-tech |
| Jane Street | custom (careers page) | quant |
| Two Sigma | greenhouse | quant |
| Citadel | greenhouse | quant |
| Hudson River Trading | ashby | quant |
| DE Shaw | custom (careers page) | quant |
| Optiver | greenhouse | quant |

### Programs (initial set)

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

Renders **above all widgets** in WidgetPanel when any program has `window_open = true`.

```
┌─────────────────────────────────────────────┐
│ 🔔  Neo Scholars — applications open        │
│     Jane Street FOCUS — deadline Oct 15  →  │
└─────────────────────────────────────────────┘
```

- One row per open program, sorted by deadline ASC (soonest first)
- Each row links to program URL, opens new tab
- Dismiss per-row (localStorage key `dismissed_program_{id}`, resets when window_open flips)
- Orange/amber accent color to distinguish from normal content

### `OpportunitiesWidget.jsx`

Lives in WidgetPanel, **above MarketNewsWidget**.

```
OPPORTUNITIES  [12 new]
──────────────────────────────────────
[All] [SWE] [Quant] [Fellowship] [Research]

● greenhouse  Anthropic — Research Engineer    2h
● hn          Stripe | SWE intern, remote      5h
● ashby       Linear — Product Engineer        1d
★ greenhouse  Two Sigma — Quant Researcher     1d
──────────────────────────────────────
  load more (saved & read)
```

- Unread count badge in header, clears as items are viewed
- Filter pills: All · SWE · Quant · Fellowship · Research · Saved
- Each row: source chip (colored by source) · company — title · time ago · bookmark toggle
- Dot = unread, no dot = read; clicking row marks read + opens URL
- Star/bookmark saves item (persists across sessions via `is_saved`)
- "Load more" reveals read + saved items below a divider
- Empty state: "No new opportunities · last checked Xm ago"
- Error state per source: "HN unavailable" shown inline, others still render

### Source chip colors
- `hn` — orange
- `greenhouse` / `lever` / `ashby` — green (ATS = verified company post)
- `github` — purple
- `program-alert` — amber (same as deadline banner)

---

## App.jsx changes

- Pass `supabase` to `WidgetPanel` (already done)
- No new state in App — widget is self-contained, reads directly from Supabase

---

## CSS

All styles in `src/styles.css` following existing patterns. New classes:
- `.deadline-banner`, `.deadline-banner-row`
- `.opp-widget`, `.opp-filter-pills`, `.opp-row`, `.opp-source-chip`, `.opp-dot`, `.opp-time`

---

## New Files

```
supabase/functions/fetch-opportunities/index.ts
supabase/functions/fetch-opportunities/hn.ts
supabase/functions/fetch-opportunities/careers.ts
supabase/functions/fetch-opportunities/github.ts
supabase/functions/fetch-programs/index.ts
supabase/migrations/0012_opportunities.sql
src/components/widgets/OpportunitiesWidget.jsx
src/components/widgets/DeadlineAlertBanner.jsx
src/components/widgets/OpportunitiesWidget.test.jsx
```

### Modified Files

```
src/components/WidgetPanel.jsx   — add OpportunitiesWidget + DeadlineAlertBanner
src/styles.css                   — new widget styles
```

---

## What's Deferred (v2)

- Twitter keyword hunting with session cookie
- LinkedIn Google Form post scraping
- Deadline email/push notifications
- User-configurable company list
- Role preference weighting / ML ranking
