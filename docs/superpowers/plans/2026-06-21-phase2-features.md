# Phase 2 Features Plan

**Date:** 2026-06-21
**Baseline commit:** 4ced443
**Branch:** master

## Context

MediaLog is a personal PWA for capturing links, notes, and AI conversations. Built on React + Vite + Supabase. No TypeScript. Styles in `src/styles.css` (CSS variables, no CSS-in-JS). Edge functions in `supabase/functions/` (Deno). All entries use the `entries` table with `status` field (`active`, `backlog`, `done`).

Key files:
- `src/App.jsx` — main app, nav, view routing (`setView('...')`)
- `src/components/QuickAdd.jsx` — quick entry form used throughout
- `src/lib/db/entries.js` — all DB queries
- `src/styles.css` — all styles

## Global Constraints

- No TypeScript — plain JS/JSX only
- No new npm packages without strong justification
- All new views wired into `App.jsx` nav + view routing
- No comments explaining what the code does — only add comments for non-obvious WHY
- Styles go in `src/styles.css` using existing CSS variables (`--surface-2`, `--border`, `--accent`, `--text-muted`, etc.)
- No trailing summaries or changelogs in code files
- Commit each task separately with a concise message

---

## Task 1: Conversation Capture QuickAdd Mode

**Spec:** `docs/superpowers/specs/2026-06-21-conversation-capture-design.md`

Add a "Conversation" mode toggle to QuickAdd:
- A button/shortcut that switches the note textarea to a larger height (~200px min) and auto-applies the `#ai-chat` tag
- Toggle label: "Conversation" with a small icon or indicator when active
- When toggled: textarea placeholder changes to "Paste conversation here…"
- The `#ai-chat` tag is added automatically to the tag field; user can still add more tags
- Toggle state resets when the form is submitted or closed
- No schema changes — uses existing entries table and tag system

**Files to touch:**
- `src/components/QuickAdd.jsx` — add mode toggle + conditional textarea height + auto-tag
- `src/styles.css` — styles for larger conversation textarea if needed

**Done when:** QuickAdd has a visible toggle that switches to conversation mode with enlarged textarea and auto-tags #ai-chat.

---

## Task 2: Browser Bookmarklet

A one-click bookmarklet that captures the current page URL + title into MediaLog without opening the app.

**How it works:**
- Bookmarklet JS: grabs `document.title` + `window.location.href`, posts to the `capture` Supabase edge function with the user's anon key + JWT
- The capture edge function already exists at `supabase/functions/capture/index.ts` — check its expected request shape
- On success: shows a brief `alert('Saved to MediaLog')` or `console.log`
- Bookmarklet goes to Inbox topic (same as capture edge function default)

**New UI: bookmarklet install page in Settings**
- Add a "Bookmarklet" tab to `src/components/SettingsView.jsx`
- Shows the bookmarklet link (a `javascript:...` href) as a draggable link the user drags to their bookmarks bar
- Includes brief instructions: "Drag to bookmarks bar. Click on any page to save it to your MediaLog inbox."
- The bookmarklet needs the user's Supabase URL + anon key (from `import.meta.env`) — these are public-safe

**Implementation note:** The bookmarklet must be a self-contained JS string. Use the `capture` edge function. Check `supabase/functions/capture/index.ts` for the expected POST body shape and auth header format.

**Files to touch:**
- `src/components/SettingsView.jsx` — add Bookmarklet tab
- `src/styles.css` — minimal styles if needed

**Done when:** Settings has a Bookmarklet tab with a draggable link that, when clicked on any page, posts to the capture function and alerts success.

---

## Task 3: Weekly Digest View

**Spec:** `docs/superpowers/specs/2026-06-21-periodic-digest-design.md`

Build an in-app digest view that shows a weekly summary of activity.

**Architecture:**
- `src/lib/db/digest.js` — `computeDigest(supabase, since)` returning `{ captured, completed, movedToActive, staleBacklog, dormantTopics, oldInbox, readingQueue }`
- `src/components/DigestView.jsx` — renders sections: "This week", "Needs attention", "Reading queue"
- Nav item "Digest" added to sidebar in `App.jsx`
- Time window selector: "7 days / 30 days / all time" buttons at top
- "Last viewed" stored in localStorage key `medialog_digest_last_viewed`; nav button shows a dot badge if not viewed this week
- All data fetched on mount; loading state shown

**Queries (all over existing tables, no new schema):**
- Captured this period: `entries` where `created_at >= since`
- Completed this period: `entries` where `updated_at >= since AND status = 'done'`
- Stale backlog: `entries` where `status = 'backlog' AND created_at < now() - 60 days`
- Old inbox: `entries` in Inbox topic where `created_at < now() - 14 days AND status != 'done'`
- Reading queue: `entries` where `status = 'active'` ordered by `created_at asc`, limit 5
- Dormant topics: `topics` where no `entries` updated in last 30 days (join or subquery)

**Files to touch:**
- `src/lib/db/digest.js` (new)
- `src/components/DigestView.jsx` (new)
- `src/App.jsx` — import, nav button, view render

**Done when:** Digest nav item appears, clicking it shows the weekly summary with all sections populated from real data.

---

## Task 4: Semantic Search

**Spec:** `docs/superpowers/specs/2026-06-21-semantic-search-design.md`

Add vector embedding search to ExploreView.

**Architecture:**
- New migration: enable `pgvector`, create `entry_embeddings` table, create `match_entries` RPC
- New edge function `supabase/functions/embed-entry/index.ts` — accepts `{ text: string }`, calls the existing `ai` edge function pattern (uses `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` env vars) with an embeddings endpoint, returns `{ embedding: number[] }`
  - **Important:** check how the existing `ai` edge function calls its provider — use the same pattern. If the provider doesn't support embeddings, use OpenAI's `text-embedding-3-small` directly via `OPENAI_API_KEY` env var (add to secrets list in README).
- `src/lib/db/entries.js` — add `searchSemantic(supabase, query)`: calls `embed-entry` edge function, then calls `match_entries` RPC
- `src/components/ExploreView.jsx` — add "Semantic" toggle next to the search bar; when active, uses `searchSemantic` instead of keyword search; shows similarity scores subtly

**Migration file:** `supabase/migrations/0024_semantic_search.sql`

```sql
create extension if not exists vector;

create table if not exists entry_embeddings (
  entry_id uuid primary key references entries(id) on delete cascade,
  embedding vector(1536),
  embedded_at timestamptz not null default now()
);

create index if not exists entry_embeddings_embedding_idx
  on entry_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_entries(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 20
)
returns table (entry_id uuid, similarity float)
language sql stable
as $$
  select
    ee.entry_id,
    1 - (ee.embedding <=> query_embedding) as similarity
  from entry_embeddings ee
  where 1 - (ee.embedding <=> query_embedding) > match_threshold
  order by ee.embedding <=> query_embedding
  limit match_count;
$$;
```

**Files to touch:**
- `supabase/migrations/0024_semantic_search.sql` (new)
- `supabase/functions/embed-entry/index.ts` (new)
- `src/lib/db/entries.js` — add `searchSemantic`
- `src/components/ExploreView.jsx` — semantic toggle

**Done when:** ExploreView has a "Semantic" mode toggle, and searching in semantic mode returns results ranked by embedding similarity. Migration pushed to remote.

---

## Task 5: capture SSRF Fix

Add `isSafeUrl` validation to the `capture` edge function before inserting the URL into the DB.

**What isSafeUrl checks:**
- URL must be `http:` or `https:`
- Must not be a private IP: `127.x`, `10.x`, `172.16-31.x`, `192.168.x`, `::1`, `localhost`
- Must not be a metadata endpoint: `169.254.x` (AWS/GCP instance metadata)

Look at how `supabase/functions/enrich/index.ts` implements `isSafeUrl` — copy the same logic into `supabase/functions/capture/index.ts`. Don't abstract into a shared file (YAGNI — only two call sites).

**Files to touch:**
- `supabase/functions/capture/index.ts`

**Done when:** capture function rejects SSRF-risk URLs with a 400 and passes safe URLs through unchanged. Deploy the function.
