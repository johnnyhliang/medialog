# GFM Table Grid Editor (Design Spec)

**Date:** 2026-07-17
**Status:** Approved, ready for planning
**Build order:** Feature B of A→B→C→D1→D2

## Purpose

Edit GFM pipe tables in the note editor as an inline spreadsheet-style grid,
never by hand-aligning pipes. Rendering in preview is already handled by
react-markdown + remark-gfm; this is about **editing**. The underlying document
stays pure GFM markdown at all times.

## Core module — `src/lib/gfmTable.js` (pure, unit-tested)

The parse/serialize round-trip is isolated from CodeMirror so it can be tested
alone and reused by Feature D's collections grid.

- `parseTable(src)` → `{ headers: string[], align: (‘left’|‘center’|‘right’|null)[],
  rows: string[][] }` or `null` if `src` is not a clean GFM table.
  - Pipe escaping (`\|`) preserved as literal cell content.
  - Ragged rows padded/truncated to header width.
- `serializeTable(model)` → tidy, column-aligned GFM string:
  - Delimiter row reflects `align` (`:---`, `:--:`, `---:`).
  - Column widths padded to the widest cell for readability.
  - Cell content re-escapes literal `|`.

**Round-trip invariant** (property test): `serialize(parse(x))` is stable —
parsing a serialized table yields an equal model.

## CodeMirror extension — `src/lib/cmTableWidget.js`

A `ViewPlugin` + `Decoration.replace` that swaps each Table node for a block
widget.

- Locate Table nodes via the lang-markdown syntax tree (GFM Table nodes),
  viewport-only for performance.
- Widget renders an editable grid (`TableGrid` React component mounted into the
  widget DOM, or a lightweight vanilla grid — implementer's choice, but it must
  share serialization with `gfmTable.js`).
- Interactions:
  - Click a cell → edit in place.
  - Tab / Shift-Tab → move across cells (wraps to next/prev row).
  - Enter in a cell → commit + add a new row below if on the last row.
  - Controls: add/remove row, add/remove column, set column alignment.
- **Commit model:** on blur, Tab-out, or any structural change, re-serialize the
  full table via `serializeTable` and replace the original text range in one
  transaction.

## Safety rules

- The widget **only re-serializes tables it parsed cleanly.** A table that
  `parseTable` rejects (malformed) is left as raw text — no silent rewrite.
- Never rewrite on mere cursor movement into the table — only on an actual edit
  or explicit control action. This avoids reflowing untouched documents.
- Undo/redo works because every commit is a single CodeMirror transaction.

## Integration points

- Consumed by `NoteEditor` / `TopicDocEditor` as an editor extension.
- Feature C (live preview) mounts this widget for tables in the unified edit mode.
- Feature D reuses `gfmTable.js` serialization and the grid component for
  collection tables.

## Testing

- `gfmTable.test.js` — parse of clean/ragged/escaped tables, reject of non-tables,
  serialize alignment + padding, round-trip property test.
- `cmTableWidget.test.js` — widget replaces a table range; edit → re-serialize
  produces expected document text; malformed table left untouched; add/remove
  row/col transforms.

## Out of scope

Cell merging, multi-line cell content (GFM tables are single-line by spec),
formulas (that's Feature D collections territory, still typed values not formulas).
