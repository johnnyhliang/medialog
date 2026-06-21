# MediaLog

A personal PWA media log - capture links, notes, and takeaways under flat topics.
Synced via Supabase. See `docs/superpowers/specs/2026-06-07-medialog-design.md`.

## Setup
1. Create a Supabase project. Run `supabase/migrations/0001_init.sql` in the SQL editor.
2. In Auth -> Providers, ensure Email (magic link) is enabled.
3. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Settings -> API).
4. `npm install` then `npm run dev`.

## Test
`npm test`

## Build & Deploy
`npm run build` produces static `dist/`. Deploy free to Netlify / Vercel / Cloudflare Pages:
set the same two `VITE_` env vars in the host's dashboard, build command `npm run build`,
publish directory `dist`. Add the deployed origin to Supabase Auth -> URL Configuration
(Site URL + Redirect URLs) so magic links resolve.

## MCP Server
The repository includes a scoped MCP server in `mcp-server/`. It exposes safe
read/search/create/move tools for topics and entries, plus read-only dashboard,
inbox, revisit, progress, activity, and trash views. It does not expose delete,
restore, pin, status, tag mutation, export, backup, or auth actions.

**Note:** MCP server schema is stale — don't wire to Claude Desktop until v2 is built.
Spec: `docs/superpowers/specs/2026-06-21-mcp-v2-design.md`

The server is now modular:

- `mcp-server/src/server.js` handles MCP lifecycle
- `mcp-server/src/router.js` handles tool dispatch
- `mcp-server/src/operations/read.js` and `mcp-server/src/operations/write.js` keep data access isolated
- `mcp-server/src/jsonrpc.js` keeps the transport easy to debug

## Install on iPhone
Open the deployed URL in Safari -> Share -> Add to Home Screen.

---

## What's Built

### Capture
- **QuickAdd** — paste URL or note; conversation mode toggle auto-tags `#ai-chat`
- **Browser bookmarklet** — Settings → Bookmarklet tab; drag to bookmarks bar
- **iOS Shortcut guide** — Settings → iOS Shortcut tab; copyable endpoint + JSON body
- **Bulk import** — paste URLs or `Title - URL` lines; AI triage assigns topics
- **Migration wizard** — imports Apple Notes HTML, Google Keep JSON, Obsidian ZIP, bare URLs
- **`capture` edge function** — secret-gated POST endpoint for bookmarklet/shortcut

### Organize
- **Topics** — flat list with archive/unarchive, entry counts, drag-free ordering
- **Inbox** — default topic; cron auto-archives stale entries
- **Tags** — free-form; set per entry; filterable in Explore

### Review
- **Archive view** — `status=done` entries grouped by topic, searchable, collapsible
- **Explore view** — keyword + semantic search (pgvector + Gemini `gemini-embedding-001`)
- **Digest view** — weekly summary: captured, completed, stale backlog, reading queue
- **Revisit** — surfaces oldest-unseen entries

### Infrastructure
- **Semantic embeddings** — auto-embedded on every save via `embed-entry` edge function; backfill script at `scripts/backfill-embeddings.js`
- **Cron jobs** — `pg_cron` + edge functions for inbox archiving and revisit surfacing
- **`enrich` edge function** — fetches page title + og:description from URLs
- **`ai` edge function** — Claude Haiku for import triage and topic suggestions

---

## TODO

### Activate (manual steps)
- [ ] **CRON_SECRET** — generate with `openssl rand -hex 32`, then `npx supabase secrets set CRON_SECRET=<value>`, then in Supabase SQL editor: `alter database postgres set app.cron_secret = '<same-value>';`
- [ ] **iOS Shortcut** — guide is in Settings → iOS Shortcut, but verify it works with a real Safari share before relying on it

### Features (planned)
- [x] **RSS feed reader** — built; FeedView polls feeds via allorigins proxy, one-click capture to entry. Add feeds in the Feed nav view.
- [ ] **Instagram Reels ingestion** — DM reel link to alt account → cron polls DM inbox → caption + Claude summary → entry in "Reels" topic. Needs `INSTAGRAM_SESSION_ID`. Plan: `docs/superpowers/plans/2026-06-21-instagram-reels.md`
- [ ] **MCP server v2** — rebuild against current schema. Spec: `docs/superpowers/specs/2026-06-21-mcp-v2-design.md`

### Tech Debt
- [ ] **`frontend-design` plugin** — shows as `unknown` version in Claude Code; may be broken. Low priority.
