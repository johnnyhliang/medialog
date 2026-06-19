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
