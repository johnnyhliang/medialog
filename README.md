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
- [ ] **Twitter agent** — get `auth_token` cookie from twitter.com DevTools, then `npx supabase secrets set TWITTER_AUTH_TOKEN=<value>` + redeploy `fetch-opportunities`
- [ ] **Apply migration 0016** — `0016_companies.sql` needs to be pushed (`npx supabase db push`) for the Companies settings tab to work
- [ ] **Deploy fetch-opportunities** — `npx supabase functions deploy fetch-opportunities` after setting Twitter secret

### Security (fix before shipping publicly)
- [ ] **`enrich` has no auth** — anyone on the internet can call it and use your Supabase compute/network as a proxy. Add JWT verification (check `Authorization` header via `supabase.auth.getUser()`) or restrict to anon key + RLS
- [ ] **`ai` has no auth** — same issue; anyone can call your AI proxy and burn your AI API credits. Add auth header check
- [ ] **`enrich` CORS is `*`** — fine for a personal tool, but means any site can call it if they know the URL
- [ ] **`capture` SSRF** — the `capture` function inserts whatever `url` the caller sends directly into the DB without `isSafeUrl` validation (unlike `enrich` which does validate). Low risk since it's secret-gated, but worth noting
- [ ] **`dangerouslySetInnerHTML` in SettingsView** — the inline `<style>` block (line 218) is static string so not exploitable now, but move it to CSS to avoid the pattern

### Features
- [ ] **Archive browsing view** — dedicated view of `status=done` entries grouped by topic; add nav button
- [ ] **Topic deletion confirm dialog** — currently soft-deletes immediately on click
- [ ] **Mobile topic menu** — hover-based three-dot menu doesn't trigger on touch; swap to tap/long-press
- [ ] **Worktree cleanup** — `git worktree remove` the 3 merged worktrees under `.claude/worktrees/`
- [ ] **Instagram Reels ingestion** — future: DM → alt account → cron edge function → Claude summary → entry (needs `INSTAGRAM_SESSION_ID` + `ANTHROPIC_API_KEY`)
