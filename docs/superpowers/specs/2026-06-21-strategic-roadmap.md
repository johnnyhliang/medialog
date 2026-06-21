# MediaLog — Strategic Roadmap (v2)

**Date:** 2026-06-21
**Status:** Living strategy doc — update as direction shifts
**Supersedes:** `2026-06-17-strategic-roadmap.md`

---

## North Star (revised)

Replace the full overhead of:
- **Browser tabs** — thousands of URLs with no context, lost to history on reset
- **Obsidian vault** — markdown mess, no mobile, manual GitHub backup, too much maintenance
- **iPhone Notes / Google Keep** — quick jots that never connect to anything
- **Messy AI chats** — good ideas and conversations copy-pasted nowhere, lost

Into one tool occupying the **fourth bucket** in a deliberate four-tool system:

| Tool | Job |
|------|-----|
| Google Calendar | Time / events |
| TickTick | Tasks |
| (health tracker) | Health metrics |
| **MediaLog** | Everything to remember / read / reference / learn |

**The loop nobody else closes end-to-end:**

```
CAPTURE → TRIAGE → CONSUME → RETAIN → SYNTHESIZE
```

Each competitor owns 1-2 stages. MediaLog's moat is closing all five without leaving the app.

---

## What's actually shipped (as of 2026-06-21)

### Core
- [x] Topics (flat, no nesting), entries, tags, status (backlog/active/done)
- [x] Quick-add form with URL enrichment (auto-title fetch)
- [x] Bulk import (paste URL list → Inbox entries)
- [x] Smart import (folder/file structure parser)
- [x] Sort Inbox triage view (one entry at a time, assign topic/tag/delete)
- [x] Entry cards: pin, expand/collapse, markdown note editor (CodeMirror), version history
- [x] Tag input with color coding
- [x] Status filter, search bar, per-topic progress view
- [x] Revisit feed (least-recently-seen, anti-rot)
- [x] Markdown export + zip download
- [x] GitHub automatic backup (topic/entry structure, restore)

### Organization
- [x] Topic lifecycle: archive, soft-delete, restore (collapsible archived section in sidebar)
- [x] Entry trash: soft-delete, restore, empty trash, undo toast
- [x] Topic three-dot menu (archive/delete), confirm dialog on delete
- [x] Mobile touch fix for topic menu
- [x] Explore view: global search + reading queue (active/backlog) across all topics, grouped by topic

### Content & capture
- [x] RSS feeds: subscribe, fetch, view feed items, save to entries
- [x] Files tab: upload, preview (PDF, image), storage bar, delete
- [x] YouTube thumbnail display on entry cards
- [x] File preview modal (PDF, images, video inline)
- [x] Entry version history drawer

### Dashboard
- [x] Home view with widget panel
- [x] Widgets: clock, weather (Open-Meteo), market data (Finnhub), search (Google/DuckDuckGo/Brave), feed items
- [x] Living topic docs (freeform markdown doc per topic, CodeMirror editor)

### Opportunity radar (job tracker)
- [x] Applications view: full job tracker
- [x] Opportunities fetcher: Twitter/X, GitHub Jobs, Hacker News
- [x] Companies settings tab: toggle tracked companies
- [x] Keywords settings tab: Twitter radar keywords
- [x] Programs tab: fellowships/internships with deadline tracking
- [x] Cron edge functions: fetch-opportunities, fetch-programs

### Auth & infrastructure
- [x] Landing page (`/`) with magic link + GitHub OAuth auth modal
- [x] `/app` React SPA with auto-redirect based on session
- [x] AuthGate: redirects to `/` if not logged in
- [x] iOS Shortcut guide for capture from any app
- [x] PWA icons, installable on iPhone
- [x] MCP server (read/search/create/move tools — built for earlier app version, not currently connected)
- [x] AI edge function (provider-agnostic, JWT-gated)
- [x] Security hardening: JWT auth on edge functions, CRON_SECRET guard, signed URLs, DB length constraints, SSRF guard

### Preservation
- [x] Wayback Machine: per-entry archive check + submit (info popup in entry card ⋮ menu)
- [x] Wayback Machine: bulk archiver in Settings (topic-level, 5s rate limit, pause/cancel)

### Settings
- [x] Settings tabs: GitHub backup, Behavior, Tags, Companies, Keywords, Programs, Bulk archive

---

## What's specced but not yet built

| Spec | Phase | Summary |
|------|-------|---------|
| [`2026-06-19-anti-clutter-quality-gates.md`](2026-06-19-anti-clutter-quality-gates.md) | 0.5 | Fuzzy duplicate detection, empty-note aging, `maybe` status, kanban/table views |
| [`2026-06-19-tuxedo-analysis.md`](2026-06-19-tuxedo-analysis.md) | 0.5 | Command palette, keyboard nav, saved searches, snooze, density toggle |
| [`2026-06-19-app-modularization-design.md`](2026-06-19-app-modularization-design.md) | infra | App.jsx split into smaller modules |
| [`2026-06-20-opportunity-radar-design.md`](2026-06-20-opportunity-radar-design.md) | shipped | Superseded — radar is built |
| [`2026-06-20-wayback-archive-design.md`](2026-06-20-wayback-archive-design.md) | shipped | Superseded — Wayback is built |
| [`2026-06-21-migration-tooling-design.md`](2026-06-21-migration-tooling-design.md) | 1 | Chrome tabs (OneTab), iPhone Notes, Obsidian vault import |
| [`2026-06-21-semantic-search-design.md`](2026-06-21-semantic-search-design.md) | C | pgvector embeddings, search by meaning not keywords |
| [`2026-06-21-conversation-capture-design.md`](2026-06-21-conversation-capture-design.md) | 1 | Dedicated AI chat log entry type, structured capture |
| [`2026-06-21-periodic-digest-design.md`](2026-06-21-periodic-digest-design.md) | B | Weekly summary: what you captured, completed, stale |
| [`2026-06-21-mcp-v2-design.md`](2026-06-21-mcp-v2-design.md) | C | MCP server rebuilt for current app shape, connected to Claude |

---

## Phase map (updated)

### Phase 1 — Make it your actual daily tool (current focus)
The app exists but you're not using it yet. Phase 1 is the migration sprint + quick-capture polish that gets you off iPhone Notes and closes the browser tabs.

- **Migration tooling** — Chrome/OneTab tab dump, iPhone Notes import, Obsidian markdown import
- **Conversation capture** — structured AI chat log entry type so messy chats have a home
- **Browser bookmarklet** — one-click desktop capture without an extension store
- **Offline / PWA reliability** — verify service worker caches enough to jot on bad connection
- **Archive browsing view** — dedicated nav view for `status=done` entries (the "read" pile)
- **Mobile polish** — test all flows on iPhone, fix any touch friction

### Phase A — Close the read→retain loop
- **Full-text mirror** — `enrich` fetches body text, stored + offline-searchable
- **Reader mode** — distraction-free view of mirrored text / PDFs
- **Highlight layer** — select text in Reader → child highlight entry linked to source
- **SRS Revisit 2.0** — SM2 algorithm over highlights (Anki-style retention)

### Phase B — Surface what you have
- **Periodic digest** — weekly in-app summary: captured, completed, stale backlog
- **Browser extension** — one-click capture from desktop Chrome (replaces bookmarklet)
- **Semantic links** — "related entries across topics" sidebar based on embeddings

### Phase C — The synthesis moat
- **Semantic search** — pgvector embeddings, search by meaning not keywords
- **AI-synthesized topic docs** — Living Topic Doc auto-drafted from entries
- **RAG chat** — "ask my library" conversational interface over your notes
- **MCP v2** — reconnect MCP server to Claude Desktop with current app shape

### Phase D — Reach
- Newsletter terminal (`@medialog` email → entries)
- Anki export
- YouTube transcript highlighting
- Public topic sharing / digital garden
- OCR physical capture
- Note-taking sync (Notion/Obsidian/Roam two-way)

---

## Guardrails (do not violate)

- **Triage is mandatory.** Every CAPTURE source dumps to Inbox for Sort gate. Never auto-file.
- **Retention is the product.** Features that add capture without retention make the graveyard worse.
- **Plain Text First.** Everything exportable as Markdown. No lock-in.
- **Source ≠ System.** Feeds/tabs/inboxes are noise until triaged into a Topic.
- **Four buckets only.** Calendar = time. TickTick = tasks. MediaLog = remember/read/reference. No creep.
- **Flat topics.** No nesting. Visual grouping is an overlay, not real hierarchy.

---

## Known gaps / tech debt

- [ ] Archive browsing view — dedicated nav for `status=done` entries, no nav button yet
- [ ] MCP server not connected to anything (built for older app shape)
- [ ] SRS algorithm not implemented — Revisit is FIFO, not SM2
- [ ] Topic doc synthesis is manual only — AI auto-draft not built
- [ ] Semantic search not built — search is keyword-only
- [ ] `enrich` fetches title only, not full body text — Reader mode prerequisite missing
- [ ] Pre-curated RSS feed list not provided — users must add feeds manually
- [ ] Instagram Reels ingestion — future (needs session token + cron)
- [ ] 3 stale git worktrees to prune: `feat/ai-infra`, `worktree-feat+feed-widget`, `worktree-feat+opportunity-radar-backend`
