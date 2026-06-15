# MediaLog — Next-Wave Roadmap (Plans 6–9)

User delegated an autonomous build of the next vision wave (2026-06-14), safety-first
order, cheap-model (Haiku) AI default, each subsystem its own PR to pick & choose.

- **Plan 6 — Editor preview + Version control** (this wave's foundation; no API, no cost).
  Live rendered-preview pane beside the CodeMirror editor; `entry_versions` history with
  view/restore. Version control is the undo safety net before AI mutates content.
- **Plan 7 — AI infrastructure.** Supabase edge function `ai` that proxies the Claude API
  with a server-side key (`ANTHROPIC_API_KEY` secret). Cheap model default. Client wrapper.
  Prerequisite for all AI features. (Consult the `claude-api` skill before writing.)
- **Plan 8 — AI features, part 1: LLM-assisted bulk import.** Paste a dump → model proposes
  topic/tags/dedupe/summary per item → user reviews → commit. Drains the backlog.
- **Plan 9 — AI features, part 2: living topic docs + chat + agentic tool-use.** Per-topic
  auto-maintained context doc; chat grounded in a topic; agent acts on content via tools
  (sort/tag/status/pin/flag-deletable) — non-destructive, confirm-gated; version control
  records its edits.

Cost/architecture: LLM key never client-side; all calls via the `ai` edge function.
Paid (no free Claude tier); Haiku keeps it ~free for personal volume.
