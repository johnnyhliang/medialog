# Tuxedo → MediaLog: Philosophy & Feature Analysis

**Date:** 2026-06-19
**Status:** Reference — ideas for future consideration
**Source:** https://github.com/webstonehq/tuxedo/

---

## Philosophy Alignment

Both share: plaintext permanence, triage-as-discipline, anti-graveyard design, one shape per data type, speed as a feature.

**Key divergence:** Tuxedo's goal is "the tool disappears into your fingers" (modal, keyboard-only). MediaLog's current goal is "the interface guides you through the loop" (directed workflow, mouse-primary). Tuxedo's biggest contribution isn't individual features — it's the **modal depth philosophy**: power ceiling is determined by how deeply you can interact without lifting your hands.

---

## Features Worth Stealing (ordered by leverage)

### 1. Command Palette — highest ROI
`Ctrl-P` or `:` → fuzzy-searchable list of every action + navigation target.
- "Sort Inbox", "Archive done", "Export", "Open topic: AI" — all from one keystroke
- Filter shortcuts: type `status:active tag:book` → executes filter
- "Jump to topic" fuzzy search (currently buried in sidebar)
- Shifts MediaLog from "app you click through" to "tool you command"

### 2. Full Keyboard Navigation Layer
- `/` → focus search
- `j/k` → move between entries in current view
- `e` → edit focused entry
- `x` → cycle status (backlog → active → done)
- `V` → visual/multi-select mode, `J/K` extend selection, then bulk tag/delete/archive
- Two-key chords (like Tuxedo's `fp` filter-by-project, `ff` saved-filters): e.g. `g i` → go to Inbox

### 3. Named Saved Searches / Saved Filters
Save a filter combo with a name, recall from palette or sidebar chip.
- "to read" = `status:backlog tag:book`
- "focus" = `topic:AI status:active`
- Missing piece between "search exists" and "search is part of your workflow"

### 4. Natural Language Capture Enhancement
Tuxedo converts prose to canonical format with a preview-and-confirm step.
- "Add Karpathy's transformer video, tag AI and video, set active" → populates all fields
- Topic suggestion from content semantics
- MediaLog already has AI edge function infra — this is a capture UX upgrade, not new infra

### 5. Snooze / Threshold Dates
User-initiated "surface this entry on date X" — entry disappears from active views until then.
- Implementation: `surface_after timestamp` column + filter in revisit query
- Complements planned SRS system — manual scheduling before SRS kicks in
- Low implementation cost, high daily value

### 6. Layout Density Toggle
`compact / comfortable / spacious` quick toggle (or just compact vs default).
- Lets power users see more entries without sacrificing readability
- Low effort, good quality-of-life

---

## Already Covered / Not a Gap
- QR code phone capture → iOS Shortcut + `capture` edge function is better for iOS
- Archive → planned Phase 0.5
- Atomic writes + external change detection → Supabase realtime is the equivalent
- 50-level undo → `entry_versions` is the foundation; general undo stack is the extension

## Doesn't Translate
- Offline-first / no cloud — MediaLog's sync is intentional
- Recurring tasks (`rec:+1m`) — entries are resources not actions; RSS (Phase B) covers this
- todo.txt format — MediaLog's data model is richer; Markdown export covers the plain-text promise
- CLI mirroring TUI — browser surface; capture edge function is the equivalent
