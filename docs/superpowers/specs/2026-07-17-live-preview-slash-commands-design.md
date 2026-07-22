# Live Preview + Slash Commands (Design Spec)

**Date:** 2026-07-17
**Status:** Approved, ready for planning
**Build order:** Feature C of A→B→C→D1→D2 (after B — reuses the table widget)

## Purpose

Bring an Obsidian-style live-preview editing experience to the note editor so
markdown *feels* like a rich document while remaining plain markdown underneath.
Add a `/` slash-command menu for inserting structured blocks. Highest-risk
feature of the four, so it ships behind a settings toggle.

## Live preview — unified edit mode

Replaces the current edit half of the edit/preview toggle. The existing
read-only preview view is **kept** (a full rendered read view is still useful and
is the safe fallback surface).

### Mechanism

- A CodeMirror `ViewPlugin` computes decorations from the lang-markdown syntax
  tree, **viewport-only**.
- The line(s) intersecting the cursor/selection are **exempted** — raw markdown
  reveals itself under the cursor; everything else renders styled.
- Marker hiding via `Decoration.replace` on syntax marks (`#`, `**`, `` ` ``,
  link brackets), styling via `Decoration.mark`.

### Rendered constructs

- Headings — sized, `#` markers hidden off active line.
- Bold / italic / strikethrough / inline code — styled, markers hidden.
- Links — collapse to link text; click opens URL (Cmd/Ctrl-click or plain click
  when not on active line).
- Blockquotes, horizontal rules.
- Task list checkboxes — real, toggleable; clicking flips `- [ ]`↔`- [x]` using
  `toggleStep` from `src/lib/goals.js` (shared with Feature A).
- Tables — rendered via Feature B's `cmTableWidget`.
- ` ```medialog:view ` fences — rendered via Feature D's view renderer.

### Escape hatch

- Settings toggle: **Live preview** on/off. Off = current plain styled-source
  editor. This ships in the same change as live preview because cursor feel, IME
  composition, and very long documents are the real risks; the toggle is the
  mitigation.

## Slash commands

- Built on `@codemirror/autocomplete`.
- Trigger: `/` at the start of an otherwise-empty line (or after whitespace on an
  empty line).
- Menu items insert snippets and place the cursor sensibly:
  - Heading 1/2/3
  - Task list
  - Table (skeleton via `serializeTable` of a 2×2 starter)
  - Goal template (`newGoalTemplate` body from `src/lib/goals.js`)
  - View block (`medialog:view` fence skeleton)
  - Quote, Divider, Code fence
- Selecting an item removes the `/query` text and inserts the block.

## Integration points

- Wraps `NoteEditor` / `TopicDocEditor` extensions.
- Depends on Feature B (`cmTableWidget`) and Feature A (`toggleStep`,
  `newGoalTemplate`).
- Feature D provides the `medialog:view` widget renderer used in live preview.

## Testing

- `slashCommands.test.js` — trigger detection (empty line vs mid-word),
  insertion output for each snippet, `/query` cleanup.
- `livePreview.test.js` — decoration builder hides markers off active line and
  reveals on active line; checkbox toggle edits correct source line; table/view
  fences delegate to their widgets. (Interaction-level; heavy visual behavior
  verified manually.)
- Manual QA checklist: IME composition, long-document scroll performance, undo,
  toggle on/off parity.

## Out of scope

WYSIWYG drag handles / block reordering (that is Notion's block model — explicitly
rejected to protect markdown round-tripping), inline image resizing, embeds beyond
`medialog:view`.
