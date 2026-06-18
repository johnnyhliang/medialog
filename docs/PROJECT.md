# MediaLog — The Complete Picture

**Canonical overview.** Everything about this project: philosophy, what's built, what's
specced, what's planned, and every idea hinted at or considered. Maintained as the single
source of truth so context survives across sessions.

Source docs (detail lives here):
- `docs/superpowers/specs/2026-06-07-medialog-design.md` — foundational design + North Star
- `docs/superpowers/specs/2026-06-15-medialog-ultimate-vision.md` — "Singular Bucket" vision, 4 pillars
- `docs/superpowers/specs/2026-06-17-strategic-roadmap.md` — the loop, competitive moat, phases
- `docs/superpowers/specs/2026-06-17-file-preview-design.md`, `…-living-topic-docs-design.md`, `…-ui-polish-plan.md`
- `docs/HANDOFF.md` — current state + next task

---

## 1. Core Philosophy

**The one-liner:** MediaLog is the "fourth bucket" in a deliberate personal system —
**the place for things to remember / read / reference.** (The other three: Google Calendar =
time, TickTick = tasks, Health tracker = metrics.) It absorbs the "remember this" inputs that
currently rot in open browser tabs.

**Founding principles (these govern every decision):**
1. **A source is not a system.** Chrome tabs, Canvas, email, feeds are *inboxes* (noise).
   MediaLog is the *system* (signal) — the small set of tools you deliberately move things into.
2. **Triage is mandatory.** Information is only useful once placed in a context (a Topic). Every
   capture path lands in `Inbox` for a forced "Sort Inbox" triage. The anti-graveyard rule.
3. **Retention is the product.** If you don't remember it, you didn't learn it. Resurfacing /
   review is baked in, not an add-on.
4. **Flat over nested.** No subtopics/folders — nesting is what created the Obsidian mess.
   One entry = exactly one topic; tags are the cross-cutting layer.
5. **One fixed shape per data type**, enforced by the form — malformed notes are impossible.
6. **Plain text underneath.** Data stays open, portable, grep-able, exportable. Never locked in.
7. **Fast interfacing.** Instant capture + navigation, keyboard/gesture-first. "If it's slow I
   won't use it" — speed is a feature, not a nicety.
8. **Non-destructive by design.** Especially for any future AI agent: it proposes destructive
   actions (delete, bulk reassign) for confirmation; only reversible actions (tag/status/pin/
   surface) run directly.

**The balance problem** (named explicitly, still the central tension): too *easy* to log =
Instagram-save graveyard with zero retention; too *hard* = you won't use it. Current answers:
age display on cards, "why did you save this?" capture prompt, empty-note nudge, the Sort-Inbox
gate. Deeper answer is the retention loop (SRS) on the roadmap.

**North Star:** MediaLog grows into a personal "system app" — *"Notion on steroids with the soul
of org-mode."* **The buckets (topics + entries) are the pillar/trunk**; everything else
(people/CRM, calendar, health, dashboard) is **auxiliary** — modules that orbit and feed the
buckets, earning their place one at a time. Eventually native, not just PWA.

**The Loop (the actual product nobody else closes end-to-end):**
`CAPTURE → TRIAGE → CONSUME → RETAIN → SYNTHESIZE`. Readwise owns capture→retain (no synthesis);
Obsidian owns synthesize (no capture/retain); Instapaper does consume; Inoreader does capture.
MediaLog's moat is closing all five in one tool.

---

## 2. What's BUILT (shipped on `feat/ai-infra`)

**Capture & organize**
- Flat **topics** + **tags** (tags also carry media-kind: `#book` `#video` `#article`…)
- **Entries**: url + auto-fetched title + markdown note + consumption `status` (backlog→active→done)
- **Quick-add** (prompt: "What's worth remembering about this?")
- **Bulk Import** (paste newline URLs → Inbox) + **Smart Import** (`scripts/parse-import.cjs`
  parses an `import/` folder of Obsidian/HTML/txt exports → `import-preview.json` → topic-classified
  review UI; temp-URL filtering for AI chats/searches/logins)
- **Sort Inbox** triage (assign topic / tag / delete, one at a time)
- **iOS Shortcut capture** via `capture` edge function (no Web Share Target on iOS Safari)
- `Inbox` system topic seeded per user

**Consume / retain / review**
- **Revisit feed** (least-recently-surfaced entries — anti-rot sweep)
- **Progress view** (per-topic status counts)
- **Entry version history** (`entry_versions`, 🕘 snapshot on Done, restore)
- **Trash** (soft-delete + confirm modal, restore, empty)

**Living topic docs** (the synthesis layer, v1)
- Per-topic **master markdown doc** (`topics.master_doc`), **Doc/List toggle**
- **`[[` entry-embed autocomplete** → inline chips with hover preview + click-to-jump + return
- **`[[#` heading references** (rehype-slug anchors, smooth-scroll)
- **Scoped fuzzy search** (this topic / this doc / everything)

**File preview**
- `classifyUrl` (pdf/image/text/drive) → lazy **FilePreviewModal**
- **PDF.js viewer** with ToC sidebar + page nav (code-split)
- Image / text / Google-Drive (iframe) viewers; Preview button on file cards; file-chips in notes

**Editor**
- CodeMirror markdown editor (write/preview/split), light theme matching UI, perf-tuned
- **Smart auto-pair punctuation** (`*`/`_`/`[` + smart backspace)

**Infra**
- **GitHub backup** (OAuth via `github-token`; `github-backup` push=markdown-per-entry, pull=restore;
  AES-GCM fixed; SPA `_redirects`) — *two-tier: text in git, binaries in Supabase*
- **Provider-agnostic AI** edge function (`ai`) + `src/lib/ai.js`
- **`enrich`** (title/link-preview fetch, SSRF-guarded)
- Markdown **export** (zip, one `.md` per topic, YAML frontmatter)
- PWA (installable, branded icons), Supabase Auth + RLS

---

## 3. SPECCED / IN-FLIGHT (designed, approved, being built next)

**UI Polish (full pass — `2026-06-17-ui-polish-plan.md`, plan `2026-06-18-ui-polish.md`)**
- Design tokens (typography/spacing/shadow/z-index scales)
- One shared **Modal primitive** (replaces 4 inconsistent modal implementations)
- **lucide-react SVG icons** for controls (emoji kept only for content-type chips)
- Fix **crowded/ugly card button row**; **Preview button shows the file name**
- Search consolidation (one affordance); master-doc/TopicView/sidebar/editor-shell polish
- Unified **empty states**, **autosave indicator**, **toast feedback**
- **Responsive/mobile** pass
- **Performance (first-class):** virtualize long entry lists (CS topic = 400+), memoize
  `MarkdownView` component map, debounce search, stable callbacks, keep heavy comps lazy
- **Image pipeline:** compressed **thumbnail inline, full image only in modal on click**, via
  **client-side canvas thumbnailing at upload** (Supabase transforms are Pro-only). Upload cap
  stays **10 MB**.
- **Backup note in UI:** attachments aren't in the git backup (two-tier by design).

---

## 4. PLANNED (roadmap — `2026-06-17-strategic-roadmap.md`)

Ordered by leverage; each is its own brainstorm → spec → plan → build cycle.

- **Phase 0 (now):** Living Topic Docs ✅ + UI polish (in flight)
- **Phase 0.5:** **Top-level visual organization** (board/grouped/pinned topics above the list —
  fixes "topic list gets long"); **Archive for stale entries** (distinct from Trash)
- **Phase A — close the read→retain loop:** **full-text mirror** (`enrich` fetches body text,
  offline+searchable) → **Reader mode** (distraction-free) → **Highlight layer** (select in
  reader → child highlight entry) → **SRS Revisit 2.0** (SM2 algorithm; the retention payoff)
- **Phase B — become the front door:** **RSS feed gathering** (sources → Inbox for triage);
  **browser extension** (one-click desktop capture)
- **Phase C — synthesis moat:** **semantic/topical search** ("find roughly-related by meaning,
  not exact text" — embeddings; the search scope-selector is designed to gain a "Related (AI)"
  mode); **AI-auto-drafted master docs**; **RAG chat** ("ask my library")
- **Phase D — reach:** **Note-taking sync** (Notion/Obsidian/Roam — the real Readwise paid
  driver; generalizes the GitHub backup); **advanced/media parsing** (EPUB, newsletter,
  **YouTube transcript highlighting**); newsletter terminal (`@medialog` email→entry); Anki
  export; public sharing / digital garden; podcast/audio + transcript; OCR physical capture

---

## 5. The Editor Overhaul (designed via Q&A, queued after polish)

User-confirmed decisions, to build after the polish foundation lands:
- **Inline edit URL/title on the card** (click title/URL or ✎ → input in place, save on blur/Enter)
- **QuickAdd uses the full CodeMirror editor** (markdown, smart-pairs) for consistency
- **Bold/italic indicators** like a word processor (toolbar state reflecting cursor context)
- Open design tension noted: inline title editing vs the auto-compute-title-from-note rule
  (manual title must not be clobbered by the next note save).

---

## 6. HINTED / CONSIDERED / IDEAS (don't lose these)

- **MonkeyType-style editor theming** — a set of good-looking predetermined CodeMirror themes,
  Esc/Tab to cycle. Future feature. (saved in agent memory: `editor-theming.md`)
- **AI agent with persistent memory = the living docs.** The agent reads per-topic living docs as
  its memory and can **act via a tool layer**: sort Inbox, set/clear status, add/remove tags, pin,
  **flag backlog items as deletable** — destructive actions gated behind confirm, safe ones direct.
- **AI auto-maintains the living doc** (not user-edited; regenerated as entries change) — the
  current manual master-doc is the human-authored v1 of this.
- **Readwise "sync" insight** — people pay because highlights auto-flow into the tool they already
  use; MediaLog's equivalent moat is "Plain Text First" + being the hub others sync from.
- **The bigger personal-system vision:** people/CRM ("who to follow up with"), Google Calendar
  two-way, absorb the self-built health tracker, a **unified dashboard**, custom bolt-on modules,
  eventually **native app**. Buckets stay the pillar; these are auxiliary.
- **YouTube:** thumbnails already shown; transcript sync + timestamp-highlighting is a future
  ingestion upgrade.
- **Weekly export reminder** to nudge the plain-text backup habit (static PWA can't auto-write disk).

---

## 7. Architecture & Stack

- **Frontend:** React 18 + Vite 5 + `vite-plugin-pwa` (client-side SPA, installable).
- **Backend:** Supabase — Postgres + Auth (magic-link, single user) + RLS + Edge Functions
  (`ai`, `enrich`, `capture`, `github-token`, `github-backup`). No server to maintain.
- **Hosting:** static deploy (Netlify/Vercel/Cloudflare). SPA `_redirects` present for OAuth.
- **Design:** warm off-white palette, **Lora** (serif headings/brand) + **DM Sans** (UI). Tokens
  being formalized in the polish pass.
- **Data model:** `topics` (now incl. `master_doc`), `entries` (url/title/note/status/pinned/
  deleted_at/last_surfaced_at), `tags` + `entry_tags`, `entry_versions`, `user_configs` (GitHub),
  attachments storage bucket. Migrations `0001`–`0008`.
- **Testing:** Vitest, colocated; `npx vitest run`. Currently green.
- **Conventions:** superpowers workflow (brainstorming → writing-plans → subagent-driven-
  development with per-task + final review). Integrate stale branches by hand, never blind-merge.

## 8. Known operational TODOs
- **Apply migrations** `0007_master_doc.sql` + `0008_entry_versions.sql` to Supabase.
- Set edge-function secrets + deploy (`ai`, `github-*`); GitHub OAuth callback = `…/settings`.
- Run `node scripts/parse-import.cjs` then Smart Import (uncheck the 3,671-entry "Resources").
