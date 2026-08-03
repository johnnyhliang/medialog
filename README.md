# MediaLog

A personal PWA media log — capture links, notes, and takeaways under flat topics.
Synced via Supabase.

> *I also want to make the disclaimer and don't want to shy away from the fact that much of the codebase was co-authored by Claude Code and has definitely still been a learning journey for me wasting time, finding issues, and overall of course not being as well versed as I would have been had I made everything from scratch. As a result, I know that this codebase is probably full of gaps but I wnat to take this as a low stakes opportunity to try to figure out my workflow, shipping something with new tools from scratch, and trying to find my limits. I don't enjoy it a whole lot because I like writing code, but take from this what you will* - I've also been quite lazy and have not gone through all the lint issues yet hence the CI github action failures

> **⚠️ Source-available, not open source. All rights reserved.**
> This repository is public so the work can be read. It carries **no licence**,
> which under copyright means no permission is granted to use, copy, modify,
> deploy, or host it. See [Licence](#licence).

**Orientation — read these before the code:**

| Doc | What it answers |
|---|---|
| [`PROJECT-STATE.md`](PROJECT-STATE.md) | **Start here.** What is built, deployed, half-built, or broken. Regenerated, never appended |
| [`CHANGELOG.md`](CHANGELOG.md) | What shipped, and the reasoning a diff can't carry |
| [`docs/README.md`](docs/README.md) | Which of the 58 docs to trust, and which are stale |
| [`docs/tech-debt.md`](docs/tech-debt.md) | Known problems, ranked |
| [`docs/limits-runbook.md`](docs/limits-runbook.md) | Emergency AI kill switch + how to change tier limits |
| [`docs/indexing-architecture.md`](docs/indexing-architecture.md) | How search indexing works, what it costs, index health, and the queue/two-phase work not yet done |
| [`docs/git-learning.md`](docs/git-learning.md) | Git for this repo's actual situations — divergence, parallel sessions, stuck rebases, escape hatches |
| [`PRODUCTION.md`](PRODUCTION.md) | Cost model, scaling, admin controls, what must not be open-sourced |

### Feature maturity & access

Features are gated by two independent fields in [`src/lib/modules.js`](src/lib/modules.js):

- **`minTier`** — `free` / `paid` / `founder`: what an account is *entitled* to
- **`stage`** — `stable` / `beta` / `experimental`: how *ready* it is

**Anything `beta` or `experimental` is founder-only regardless of `minTier`.** That's
the point — marking a feature experimental hides it from users automatically, so a
half-built surface can't ship because someone forgot to also change the tier.
Promote by deleting one line.

Currently experimental: archival, assistant, metrics, reels · beta: reading,
progress, tidy. Full reasoning in
[`docs/product-scope-audit.md`](docs/product-scope-audit.md).

See `docs/superpowers/specs/2026-06-07-medialog-design.md` for the original design.

---

## Configuration

### Frontend — `.env.local`

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → `anon` `public` key |
| `VITE_GITHUB_CLIENT_ID` | GitHub → Settings → Developer settings → OAuth Apps (optional — used for GitHub Trending widget) |

If you're deploying to Netlify / Vercel / Cloudflare Pages, set these same vars in your hosting dashboard (`.env.local` is local-only and not committed to git).

> **Do not add `VITE_CAPTURE_SECRET`.** It used to exist and was removed 2026-07-30:
> any `VITE_`-prefixed value is inlined into the JS bundle at build time, so it
> shipped the shared capture secret to every visitor. Capture now uses per-user
> tokens minted in **Settings → Capture tokens**, stored as SHA-256 hashes. Adding
> that variable back would reintroduce the hole.

### Supabase Secrets — edge functions

Set via `npx supabase secrets set KEY=value` (or the Supabase dashboard → Edge Functions → Secrets):

| Secret | Required for | How to get |
|---|---|---|
| `GEMINI_API_KEY` | Semantic search embeddings, reel caption summarization | [aistudio.google.com](https://aistudio.google.com) → Get API key |
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
7. Copy `.env.example` to `.env.local`, fill in the vars
8. Mint a capture token in Settings → Capture tokens (for the bookmarklet / iOS Shortcut)
9. `npm install && npm run dev`

## Test

`npm test`

## Build & Deploy

`npm run build` produces static `dist/`. Deploy free to Netlify / Vercel / Cloudflare Pages:
set the `VITE_` env vars in the host's dashboard, build command `npm run build`,
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
- **`capture` edge function** — POST endpoint authenticated by a per-user token (Settings → Capture tokens)
- **Instagram Reels** — ⚠️ **parked** (founder-only, cron unscheduled). Depended on a scraped session cookie: fragile and ToS-grey. Code kept, not running.

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

## Not losing your data

Supabase is a hosted Postgres, which means **your data has exactly as many copies
as you have arranged for it to have.** Nothing here is automatic. The list below is
ordered by how much it protects you per minute spent.

### 1. Turn on Supabase backups — this is the one that matters

Free-tier projects get **no automatic database backups at all**, and they pause
after a period of inactivity. Daily backups start on the Pro tier; point-in-time
recovery is a further add-on worth evaluating once there is data you would grieve.

This is a dashboard setting, not something the repo can do for you, and no amount
of application-level backup substitutes for it — a GitHub backup restores *content*,
not the database.

> `PRODUCTION.md` tracks this as a launch checklist item. If the box is still
> unchecked there, assume it is off.

### 2. Turn on GitHub backup, then confirm it is actually running

Settings → GitHub connects a repo and pushes your library to it as **both** exact
JSON rows (`data/*.json`, what a restore reads) and browsable Markdown
(`notes/<topic>/*.md`, one file per entry). The Markdown matters: it stays readable
in any text editor and outlives MediaLog itself.

Two things to know about the automatic version:

- **Auto-backup only runs while a browser tab is open.** It is a timer in the app,
  not a server cron. Closing the tab stops it.
- **It fails quietly by design** — a background backup must never interrupt what you
  are doing. It records why instead. If you suspect it has stopped, check
  `user_configs.last_error` and look at your backup repo's commit history. This path
  did silently nothing for months once, which is why that column exists.

Press **Back up now** in Settings → GitHub after any session you would hate to redo.

### 3. Export a zip periodically

Sidebar → Export downloads every topic as Markdown with YAML front-matter. It is a
single click, needs no third-party account, and is the copy that survives you losing
access to both Supabase and GitHub. Keep one somewhere neither service controls.

### What the GitHub backup does and does not carry

Backed up (`SYNC_TABLES` in `src/lib/githubSync.js` is the authoritative list):

> topics · entries · tags · entry_tags · entry_versions · highlights ·
> resource_sections · feeds · opportunities · applications · opportunity_state ·
> assistant_conversations · assistant_messages · menu_items · quick_links ·
> programs · companies · shared_items

**Deliberately not backed up**, and worth knowing rather than discovering later:

| Not carried | Why |
|---|---|
| **Uploaded files, images, PDFs** | The `snapshots` storage bucket holds bytes; a git backup carries text. **These have one copy.** |
| Embeddings & chunks | Derived — rebuilt by `scripts/rechunk.js`. Backing them up would add megabytes of churn to every commit. |
| `feed_items` | Refetched from your feed list on the next poll. |
| `user_configs` | Holds your encrypted GitHub token. Never leaves the database. |
| `capture_tokens` | Capture credentials. Revocable secrets do not belong in a file. |
| Billing, entitlements, telemetry | Server-owned. Restoring your own tier from an editable file is not a feature. |

The full list with reasons is `EXCLUDED_TABLES` in the same file, and it is rendered
into the README of your backup repo on every push, so the repo always explains
itself.

**The attachment gap is the sharp edge.** Preserved PDFs and images exist only in
Supabase Storage. If that matters to you, download them separately — losing the
project loses them.

### Restoring

Settings → GitHub → Restore reads `data/*.json` and **upserts by primary key**, so
restoring twice is a no-op rather than a library duplicated. Nothing is ever
deleted by a restore; it can only add rows back or update them in place. A backup
restored into a different account is re-stamped to that account's `user_id`.

Restore order follows `SYNC_TABLES` front to back, parents before children, so
foreign keys are satisfiable as it goes. That ordering is asserted by tests — it is
a correctness property, not a tidy list.

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

---

## Licence

**All rights reserved.** © Johnny Liang.

This repository is public so the work can be read and evaluated. It is **not open
source** and carries no licence. Under copyright law, the absence of a licence
means no permission is granted to use, copy, modify, distribute, deploy, or host
this software or any derivative of it.

GitHub's Terms of Service permit viewing and forking *within GitHub*. They grant
nothing beyond that.

If you want to use any part of this, ask.
