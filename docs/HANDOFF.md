# MediaLog — Session Handoff

**Date:** 2026-06-18
**Branch:** `feat/ai-infra` (all work lives here; `master` is the base)
**State:** build green, **135 tests passing**, working tree clean, no junk branches/worktrees.

---

## What MediaLog is
A personal PWA "single bucket" for capturing/organizing/retaining media & links — meant to
supersede the Readwise + Instapaper + Obsidian workflow. React 18 + Vite 5 + vite-plugin-pwa,
Supabase (Postgres/Auth/Edge Functions/RLS). Warm off-white design, Lora + DM Sans.
Vision + strategy: `docs/superpowers/specs/2026-06-15-medialog-ultimate-vision.md` and
`2026-06-17-strategic-roadmap.md`.

## What's already built & on the branch
- **Capture/organize:** topics, entries (url+title+note), tags, pin, status, Sort Inbox (triage),
  Revisit, Progress, Trash (soft-delete + confirm modal), Export (zip of markdown), Smart Import
  (`scripts/parse-import.cjs` → `import-preview.json` → Bulk Import UI).
- **File preview:** `classifyUrl` + lazy `FilePreviewModal` (PDF.js viewer w/ ToC + page nav,
  image/text/Drive viewers), Preview button on file-URL cards, file-chips in note markdown,
  smart auto-pair punctuation in the editor, one-time nudge.
- **Living topic docs:** per-topic master markdown doc (`topics.master_doc`), Doc/List toggle,
  `[[` entry-embed autocomplete → chips w/ hover preview + click-to-jump, `[[#` heading
  references (rehype-slug anchors), scoped fuzzy search (`fuzzyFind`).
- **Version history:** `entry_versions` table, 🕘 history button, snapshot on Done, restore.
- **GitHub backup:** OAuth (`github-token` fn) + `github-backup` fn (push = markdown-per-entry;
  pull = restore). AES-GCM key padding fixed, SPA `_redirects` added.
- **AI infra:** provider-agnostic `ai` edge function + `src/lib/ai.js`.

## ⚠️ Gotchas / things to know
- **Windows + PowerShell** environment. CRLF warnings on commit are normal/ignorable.
- **Two migrations are NOT yet applied to Supabase:** `0007_master_doc.sql` and
  `0008_entry_versions.sql`. The user must apply them before the master-doc / version features
  work live. Edge functions `ai`/`github-*` need their secrets set + deploy (see prior commits).
- **`.env.local`** has Supabase + `VITE_GITHUB_CLIENT_ID`. Don't commit it.
- **Worktrees lesson:** earlier "parallel worktrees" (emdash/editor-versioning) were branched
  from a 41-commit-old base and reimplemented overlapping files. We **integrated by hand
  (lifted clean new files + ported additive edits), never `git merge`** — merging would have
  regressed the embed/file-preview system. If more stale branches appear, do the same.
- **CodeMirror perf:** extensions must be memoized / hoisted — rebuilding them per render makes
  CM reconfigure on every keystroke (already fixed in `NoteEditor.jsx`; keep the pattern).
- **Supabase image transforms are Pro-plan only** — do image compression client-side (canvas).
- **Tests:** Vitest, colocated. Run `npx vitest run`. (The old "4 pre-existing failures" are gone.)
- **Skills workflow used here:** brainstorming → writing-plans → subagent-driven-development
  (fresh subagent per task + task review + final review). Commits end with the Co-Authored-By line.

## Current focus → THE NEXT TASK
**UI polish + attachments + performance.** The design/spec is DONE and approved:
`docs/superpowers/specs/2026-06-17-ui-polish-plan.md` (read it fully — decisions are locked).

Locked decisions:
- **Full pass, Phases 0–4.**
- **Switch control icons to `lucide-react` SVGs** (keep emoji only for content-type chips).
- **Preview button must show the file name** (URL last segment or uploaded filename), not "Preview".
- **Images: compressed thumbnail inline, full image only in the modal on click** — via
  **client-side canvas thumbnailing at upload** (upload thumb + original; free-tier, no Pro transforms).
- **Upload cap stays 10 MB** (no change).
- **Backup: keep two-tier** (git = text/structure, Supabase = binaries); attachments are NOT in
  the git backup — surface that in the Settings/Backup UI.
- **Performance is first-class** — add a Phase 1.5: list virtualization for long entry lists
  (CS topic has 400+), memoize `MarkdownView` component map, debounce search, stable callbacks.

**First action for the new session:** use the **writing-plans** skill to turn
`2026-06-17-ui-polish-plan.md` into a phased implementation plan
(`docs/superpowers/plans/2026-06-18-ui-polish.md`) with exact code per task, then execute it
**subagent-driven** (the user auto-approves and prefers subagents). Recommended ordering: lead
with the things the user directly complained about — button row spacing + sizing, lucide icons,
preview-button filename — so the visible wins land first; then the Modal primitive/tokens,
performance, image pipeline, and the rest.

## After the polish pass (future, in the roadmap)
- **Editor overhaul** (already designed-ish): inline URL/title edit on cards, QuickAdd uses the
  full editor, bold/italic indicators. Foundation = polish Phase 1 tokens + editor shell.
- Roadmap Phase 0.5: top-level visual organization, archive for stale entries.
- Phase A+: full-text mirror → Reader → highlights → SRS. Phase C: semantic search / AI synthesis.
  All in `2026-06-17-strategic-roadmap.md`.
