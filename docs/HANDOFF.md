# MediaLog — Session Handoff

**Date:** 2026-06-23
**Branch:** `master` (all work is here; no active feature branches)
**State:** build green, tests passing, working tree clean.

---

## What MediaLog is

A personal PWA "single bucket" for capturing, organizing, and retaining media & links — meant to
supersede the Readwise + Instapaper + Obsidian stack. React 18 + Vite 5 + vite-plugin-pwa,
Supabase (Postgres / Auth / Edge Functions / RLS). Warm palette, Lora + DM Sans typography.
Philosophy + vision: `docs/superpowers/specs/2026-06-15-medialog-ultimate-vision.md` and
`docs/superpowers/specs/2026-06-21-strategic-roadmap.md`.
Full feature history + roadmap: `docs/PROJECT.md` (read this for design decisions).

---

## What's built (current, on master)

**Capture & organize**
- Flat **topics** + **tags** (tags carry media-kind: `#book` `#video` `#article` etc.)
- **Entries**: url + auto-fetched title + markdown note + `status` (backlog → active → done)
- **Quick-add** (pipeline: save → enrich title → embed; saving/saved/failed states shown)
- **Bulk Import** (paste newline URLs → Inbox) + **Smart Import** (Obsidian/HTML/txt → review UI)
- **Sort Inbox** triage (assign topic / tag / delete, one at a time)
- **iOS Shortcut capture** via `capture` edge function (bookmarklet with saving/saved/failed feedback)
- Duplicate detection in capture endpoint
- `Inbox` system topic seeded per new user

**Consume / retain / review**
- **Revisit feed** (least-recently-surfaced entries)
- **Progress view** (per-topic status counts)
- **Entry version history** (`entry_versions`, snapshot on Done, restore)
- **Trash** (soft-delete + confirm modal, restore, empty trash)
- **Archive** (ArchiveView — unarchive / delete topic actions with confirm modal)
- **Snooze** (surface_after column, date picker in entry menu, clock indicator on card)
- **Digest** (stale backlog, inbox age, active queue, dormant topics — passive report, not yet actionable)

**Navigation & UX**
- **Command palette** with fuzzy search and full keyboard nav
- **vim j/k navigation** on entry cards with keyboard focus ring (guarded: disabled when palette query is non-empty)
- **Recent searches** dropdown on Explore search bar
- **Home view** — left: InboxCard + TopicsGrid; right: WidgetPanel
- **HomeReviewSummary** — inbox count, stale count, active queue count, recommended next action
- **Error toasts** on failed entry, feed, and application mutations

**Widgets (WidgetPanel)**
- ClockWidget, SearchWidget (Google/DDG/Kagi, engine persisted), QuickLinksWidget
- MarketNewsWidget (market prices + movers), FeedWidget (RSS headlines)
- FocusWidget (active entry + next action from topic master doc)
- OpportunitiesWidget (HN filter, interleaved source ordering by priority)
- WeatherWidget, DeadlineAlertBanner

**Applications tracker**
- Opportunity status pipeline, notes, URLs, applied dates, deadlines
- Prefill from opportunities radar (fetch-opportunities, fetch-programs edge functions)
- CompaniesTab in settings, KeywordsTab, ProgramsTab

**Living topic docs** (synthesis layer)
- Per-topic master markdown doc (`topics.master_doc`), Doc/List toggle
- `[[` entry-embed autocomplete → inline chips with hover preview + click-to-jump + return
- `[[#` heading references (rehype-slug, smooth-scroll), scoped fuzzy search

**File preview**
- `classifyUrl` → lazy `FilePreviewModal` (PDF.js viewer w/ ToC + page nav, image/text/Drive viewers)
- Wayback Machine integration (WaybackPopup, `wayback.js`)

**Theme system**
- `useTheme` hook — 4 dark CSS palettes × 2 style modes (brutalist / glass)
- Stored in `localStorage` + synced to `user_configs` in Supabase (`0027_user_theme.sql`)
- AppearanceSettings tab with palette swatches and style mode cards
- Keybinds settings tab with click-to-rebind and conflict detection

**Editor**
- CodeMirror markdown (write/preview/split), smart auto-pair punctuation, perf-tuned

**Infra & backend**
- **GitHub backup** (OAuth via `github-token`; `github-backup` push = markdown-per-entry; pull = restore)
- **Provider-agnostic AI** edge function (`ai`) + `src/lib/ai.js`
- **`enrich`** — title/link-preview fetch, SSRF-guarded
- **`embed-entry`** — semantic embeddings via `0024_semantic_search.sql`; `crawlArchive.js` backfill script
- **Instagram reels** — `fetch-reels` edge function polls DM inbox, Gemini-2.0-flash-lite summarizes, upserts entries; scheduled via pg_cron (`0025_reels_topic.sql`, `0026_reels_cron.sql`)
- **Opportunity pipeline** — `fetch-opportunities` (GitHub), `fetch-programs` edge functions; `0013_opportunities.sql`–`0016_companies.sql`
- **Markdown export** (zip, one `.md` per topic, YAML frontmatter), **StorageBar**
- **LandingPage** is now a React component (env-based Supabase, no hardcoded keys)
- PWA (installable, branded icons), Supabase Auth + RLS, magic-link login

**Migrations applied (0001–0028):**
Core: init, pinned, github_config, attachments_storage, rpc_tags, trash, master_doc, entry_versions, tag_colors, archive_toast_setting, topic_icon
Extensions: feeds, opportunities, seed_programs, cron_jobs, companies, topic_lifecycle, wayback, cron_secret, length_constraints, private_attachments, twitter_token, cron_vault, semantic_search, reels_topic, reels_cron, cleanup_stale_program_alerts, user_theme, snooze

---

## Active spec / current focus

**Product holes + polish — `docs/superpowers/specs/2026-06-23-product-holes-polish-plan.md`** (dated today)
This is the grounded product audit. Big holes identified:
1. **Mojibake / encoding corruption** — visible `â€¦` `Â·` `Ã—` sequences in runtime UI (entry cards, quick-add, sidebar)
2. **Silent failures** — autosave failure resets to idle, feed refresh failures swallowed, backup failures silent
3. **No daily loop** — many views but no guided "what to do next" flow
4. **Digest is passive** — reports findings but offers no inline actions

**Supabase key migration** — `docs/superpowers/specs/2026-06-23-supabase-key-migration.md`
Spec for migrating to publishable (formerly "anon") keys, account linking, and transactional email.
The `useSession` hook had a race condition (fixed in c062292): must wait for `INITIAL_SESSION` event
before clearing `loading`, otherwise magic-link redirects flash the login form.

---

## Gotchas / things to know

- **Windows + PowerShell** — CRLF warnings on commit are normal/ignorable.
- **Stale branches / worktrees:** if old feature branches appear, integrate by hand (lift clean files, port additive edits). Never `git merge` stale branches — will regress the embed/file-preview system.
- **CodeMirror perf:** extensions must be memoized / hoisted outside the render function — rebuilding per render makes CM reconfigure on every keystroke. The fix is in `NoteEditor.jsx`; keep the pattern.
- **Supabase image transforms are Pro-plan only** — do image compression client-side (canvas) at upload.
- **`VITE_GEMINI_API_KEY`** is reused for both the reel summarizer and any Gemini AI calls — there is no separate Anthropic key in the env; the `ai` edge function is provider-agnostic.
- **Capture edge function** uses `CAPTURE_SECRET` + `CAPTURE_USER_ID` — personal deployment only. Authenticated capture path is on the roadmap.
- **Two-tier backup:** git backup = text/structure only; Supabase storage = binaries/attachments. Attachments are NOT in the GitHub backup — this is by design and should be surfaced in the Settings/Backup UI.
- **`j/k` vim nav in command palette** is guarded to skip when the query is non-empty (fixed bug: was firing on letter keys in search).
- **useSession race condition** (fixed): always wait for `INITIAL_SESSION` event before clearing the `loading` flag. Earlier approach with `getSession().then()` alone could produce a login-flash on magic-link redirect.
- **Testing:** Vitest, colocated. Run `npx vitest run`. All passing.
