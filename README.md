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

The server is now modular:

- `mcp-server/src/server.js` handles MCP lifecycle
- `mcp-server/src/router.js` handles tool dispatch
- `mcp-server/src/operations/read.js` and `mcp-server/src/operations/write.js` keep data access isolated
- `mcp-server/src/jsonrpc.js` keeps the transport easy to debug

## Install on iPhone
Open the deployed URL in Safari -> Share -> Add to Home Screen.

---

## TODO

### Activate
- [ ] **CRON_SECRET setup** — (1) `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate, (2) `npx supabase secrets set CRON_SECRET=<value>`, (3) in Supabase SQL editor: `alter database postgres set app.cron_secret = '<same-value>';` — must do 2 and 3 together or cron gets 403s

### Security (remaining)
- [ ] **`enrich` CORS is `*`** — fine for a personal tool, but means any site can call it if they know the URL
- [ ] **`capture` SSRF** — the `capture` function inserts whatever `url` the caller sends directly into the DB without `isSafeUrl` validation (unlike `enrich` which does validate). Low risk since it's secret-gated, but worth noting

### Features
- [ ] **Archive browsing view** — dedicated view of `status=done` entries grouped by topic; add nav button. Plan: `docs/superpowers/plans/2026-06-21-archive-browsing-view.md`
- [ ] **`capture` SSRF fix** — add `isSafeUrl` validation to the capture edge function before inserting `url` into DB. Low priority (secret-gated) but clean it up before wider use
- [ ] **Instagram Reels ingestion** — DM reel link to configured alt account → cron edge fn polls DM inbox → fetches caption via private API → Claude Haiku summary → creates entry in "Reels" topic. Needs: `INSTAGRAM_SESSION_ID`, `ANTHROPIC_API_KEY`. Video transcription (Whisper) is v2. Plan: `docs/superpowers/plans/2026-06-21-instagram-reels.md`
- [ ] **From roadmap (other agent)** — migration assistant, conversation capture, weekly digest, semantic search, MCP v2. See `docs/superpowers/specs/` for specs
- [ ] **Browser bookmarklet** — one-click desktop capture without opening the app; no spec yet, Phase 1 priority
- [ ] **iOS Shortcut** — Share Sheet → MediaLog QuickAdd; guide exists in app but not verified set up. Test with a real share before relying on it.
- [ ] **Conversation capture QuickAdd mode** — `#ai-chat` tag shortcut + larger note textarea; spec at `docs/superpowers/specs/2026-06-21-conversation-capture-design.md`. No schema change needed, just UI.
- [ ] **OneTab bulk import fix** — bulk importer currently expects bare URLs; OneTab exports `title - url` per line. Small parser fix in bulk importer, then the tab-dump migration path works today.

### Tech Debt
- [ ] **Prune stale git worktrees** — `feat/ai-infra`, `worktree-feat+feed-widget`, `worktree-feat+opportunity-radar-backend` are orphaned. Run `git worktree prune` and delete the branches if not needed.
- [ ] **MCP server is stale** — `mcp-server/` was built for an older schema. Does not know about RSS feeds, files, topic lifecycle, Wayback data, or the current DB shape. Don't wire it to Claude Desktop until v2 is built (Phase C, after semantic search). Spec: `docs/superpowers/specs/2026-06-21-mcp-v2-design.md`
- [ ] **`frontend-design` plugin** — shows as `unknown` version in Claude Code; may be broken. Low priority.
