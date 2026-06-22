# MediaLog

A personal PWA media log - capture links, notes, and takeaways under flat topics.
Synced via Supabase. See `docs/superpowers/specs/2026-06-07-medialog-design.md`.

---

## Configuration

### Frontend — `.env.local`

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → `anon` `public` key |
| `VITE_GITHUB_CLIENT_ID` | GitHub → Settings → Developer settings → OAuth Apps (optional — used for GitHub Trending widget) |
| `VITE_CAPTURE_SECRET` | Generate: `openssl rand -hex 16` — must match the `CAPTURE_SECRET` Supabase secret below |

If you're deploying to Netlify / Vercel / Cloudflare Pages, set these same four vars in your hosting dashboard (`.env.local` is local-only and not committed to git).

### Supabase Secrets — edge functions

Set via `npx supabase secrets set KEY=value` (or the Supabase dashboard → Edge Functions → Secrets):

| Secret | Required for | How to get |
|---|---|---|
| `GEMINI_API_KEY` | Semantic search embeddings, reel caption summarization | [aistudio.google.com](https://aistudio.google.com) → Get API key |
| `CAPTURE_SECRET` | Bookmarklet + iOS Shortcut capture endpoint | Same value as `VITE_CAPTURE_SECRET` above |
| `CAPTURE_USER_ID` | Capture endpoint, Instagram Reels ingestion | Supabase dashboard → Authentication → Users → copy your user UUID |
| `CRON_SECRET` | All scheduled cron jobs | Generate: `openssl rand -hex 32` |
| `INSTAGRAM_SESSION_ID` | Instagram Reels ingestion (optional) | instagram.com → DevTools → Application → Cookies → `sessionid` value |

### Manual SQL step (one-time)

After setting `CRON_SECRET`, run this in the Supabase SQL editor so pg_cron can read it:

```sql
alter database postgres set app.cron_secret = '<your-CRON_SECRET-value>';
```

Also set the Supabase URL for cron callbacks:

```sql
alter database postgres set app.supabase_url = 'https://<your-project-ref>.supabase.co';
```

---

## Setup

1. Create a Supabase project
2. In Auth → Providers, enable Email (magic link)
3. Run migrations: `npx supabase db push` (or run `supabase/migrations/*.sql` in order via the SQL editor)
4. Deploy edge functions: `npx supabase functions deploy`
5. Set Supabase secrets (see table above)
6. Run the manual SQL steps above
7. Copy `.env.example` to `.env.local`, fill in the four vars
8. `npm install && npm run dev`

## Test

`npm test`

## Build & Deploy

`npm run build` produces static `dist/`. Deploy free to Netlify / Vercel / Cloudflare Pages:
set the four `VITE_` env vars in the host's dashboard, build command `npm run build`,
publish directory `dist`. Add the deployed origin to Supabase Auth → URL Configuration
(Site URL + Redirect URLs) so magic links resolve.

## Install on iPhone

Open the deployed URL in Safari → Share → Add to Home Screen.

---

## What's Built

### Capture
- **QuickAdd** — paste URL or note; conversation mode toggle auto-tags `#ai-chat`
- **Browser bookmarklet** — Settings → Bookmarklet tab; drag to bookmarks bar
- **iOS Shortcut guide** — Settings → iOS Shortcut tab; copyable endpoint + JSON body
- **Bulk import** — paste URLs or `Title - URL` lines; AI triage assigns topics
- **Migration wizard** — imports Apple Notes HTML, Google Keep JSON, Obsidian ZIP, bare URLs
- **`capture` edge function** — secret-gated POST endpoint for bookmarklet/shortcut
- **Instagram Reels** — DM a reel to your alt account → cron polls inbox → Gemini summary → entry in "Reels" topic. Needs `INSTAGRAM_SESSION_ID`. See Settings → Instagram.

### Organize
- **Topics** — flat list with archive/unarchive, entry counts, drag-free ordering
- **Inbox** — default topic; cron auto-archives stale entries
- **Tags** — free-form; set per entry; filterable in Explore
- **Snooze** — hide an entry until a future date via entry menu

### Review
- **Archive view** — `status=done` entries grouped by topic, searchable, collapsible
- **Explore view** — keyword + semantic search (pgvector + Gemini `gemini-embedding-001`); recent searches dropdown
- **Digest view** — weekly summary: captured, completed, stale backlog, reading queue
- **Revisit** — surfaces oldest-unseen entries
- **Feed reader** — RSS/Atom feeds via allorigins proxy, one-click capture to entry

### Navigation
- **Command palette** — Cmd/Ctrl+K; fuzzy search over topics, entries, and actions
- **Keyboard nav** — j/k moves between entries; e to edit; x to cycle status; gi/gs go-to shortcuts

### Infrastructure
- **Semantic embeddings** — auto-embedded on every save via `embed-entry` edge function; backfill: `node scripts/backfill-embeddings.js`
- **Cron jobs** — `pg_cron` + edge functions for inbox archiving, revisit surfacing, and Instagram Reels polling
- **`enrich` edge function** — fetches page title + og:description from URLs
- **`ai` edge function** — Gemini for import triage and topic suggestions

## MCP Server

The repository includes a scoped MCP server in `mcp-server/`. It exposes safe
read/search/create/move tools for topics and entries, plus read-only dashboard,
inbox, revisit, progress, activity, and trash views.

**Note:** MCP server schema is stale — don't wire to Claude Desktop until v2 is built.
Spec: `docs/superpowers/specs/2026-06-21-mcp-v2-design.md`

---

## TODO

### Activate (manual steps)
- [ ] **`app.supabase_url` GUC** — run `alter database postgres set app.supabase_url = 'https://<ref>.supabase.co';` in SQL editor (needed for cron callbacks)
- [ ] **`app.cron_secret` GUC** — run `alter database postgres set app.cron_secret = '<CRON_SECRET>';` in SQL editor
- [ ] **iOS Shortcut** — verify with a real Safari share (guide in Settings → iOS Shortcut tab)
- [ ] **Instagram Reels** — deploy function + set `INSTAGRAM_SESSION_ID` secret (guide in Settings → Instagram tab)

### Features (planned)
- [ ] **Full-text mirroring** — store article body at capture time (Mozilla Readability); unlocks reader mode, highlights, SRS
- [ ] **Semantic links sidebar** — "Related entries" panel using existing `match_entries` RPC; quick win, no new infra
- [ ] **MCP server v2** — rebuild against current schema. Spec: `docs/superpowers/specs/2026-06-21-mcp-v2-design.md`

### Tech Debt
- [ ] **`frontend-design` plugin** — shows as `unknown` version in Claude Code; may be broken. Low priority.
