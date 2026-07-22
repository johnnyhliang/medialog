# Collections + Embedded Views (Design Spec)

**Date:** 2026-07-17
**Status:** Approved, ready for planning
**Build order:** Feature D of A→B→C→D1→D2 (largest; split into D1 then D2)

## Purpose

Replace Coda-style databases: query structured data and embed live views inside
any markdown note via a fenced directive block. Views render live in-app and
**materialize to static GFM tables on export** so the source stays markdown-native
and round-trippable.

---

## Phase D1 — Embedded views over existing data

### The block

A fenced code block with info string `medialog:view` anywhere in a note:

````
```medialog:view
source: entries          # entries | goals | collection/<name>
topic: AI Safety         # entries: filter by topic name
tag: book                # entries: filter by tag
status: active           # entries/goals: backlog|active|done
sort: -created_at        # field, prefix - for descending
columns: title, tags, status
layout: table            # table | cards
limit: 50
```
````

### Rendering

- Parser `src/lib/viewBlock.js` (pure): `parseViewConfig(src)` → typed config
  object, with validation + friendly error messages for unknown keys/sources.
- Renderer used in **two** surfaces:
  - react-markdown (read-only preview) via a custom `code` component that detects
    the `language-medialog:view` class.
  - Feature C live-preview editor via a CodeMirror widget.
- `runView(config)` queries Supabase (entries/goals) with RLS doing the scoping,
  returns rows; renderer draws a table (reusing table styles) or card layout.
- Entry/goal views are **read-only** with click-through to the source entry.
- Errors (bad config, no source) render an inline muted error box, never crash
  the note.

### D1 export

On export, each `medialog:view` block is replaced by:

```
<!-- medialog:view source=entries topic="AI Safety" status=active … -->
| title | tags | status |
| ----- | ---- | ------ |
| …materialized rows at export time… |
```

The HTML comment preserves the original config so **import can restore the live
block**. Import (`parseMigration` path) detects the comment + following table and
rehydrates the fenced block.

---

## Phase D2 — Custom collections (the Coda part)

### Schema — migration `0043_collections.sql`

```sql
create table collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  schema     jsonb not null default '[]',  -- [{id, name, type}]
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table collection_rows (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  data          jsonb not null default '{}',  -- keyed by column id
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

alter table collections enable row level security;
alter table collection_rows enable row level security;
create policy "own collections" on collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own collection_rows" on collection_rows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Column `type` ∈ `text | number | date | checkbox | select | url`. For `select`,
the column definition carries `options: string[]`.

### UI

- `CollectionsView.jsx` — list of collections; create/rename/delete.
- `CollectionView.jsx` — opens one collection as an editable grid **reusing
  Feature B's grid component** with typed cells, add/remove row & column, schema
  editing (column name/type/options), sort, and simple filter.
- `medialog:view` with `source: collection/<name>` renders that collection;
  **collection views embedded in notes are editable inline** (unlike read-only
  entry/goal views).

### D2 export

Each collection exports as its own `.md` file:

```markdown
---
type: collection
name: Workouts
columns:
  - { id: c1, name: Date, type: date }
  - { id: c2, name: Exercise, type: text }
  - { id: c3, name: Reps, type: number }
---
| Date | Exercise | Reps |
| ---- | -------- | ---- |
| …rows… |
```

Import parses the frontmatter schema + table rows back into `collections` /
`collection_rows`. `collection/<name>` view blocks materialize like D1 blocks.

## Integration points

- `viewBlock.js` + renderer consumed by react-markdown preview and Feature C.
- Grid component + `gfmTable.js` serialization shared with Feature B.
- Export/import extends the existing `ExportModal` / `parseMigration` flow.
- Nav: `collections` view (likely in the `library` or `more` group).

## Testing

- `viewBlock.test.js` — config parse (valid/invalid keys, sort prefix, all
  sources), error objects for bad input.
- `runView` — query building per source/filter (mocked Supabase), sort/limit.
- Export round-trip — live block → comment+table → re-import → equal live block.
- D2: `collections` CRUD, schema edits preserve row data keyed by column id,
  typed cell validation, collection export/import round-trip.

## Rollout note

D1 delivers the common dashboards (reading lists, topic/goal rollups) with **no
migration**. D2 is the largest single unit of the four features and should only
start after D1 proves the block format and A/B are shipped.

## Out of scope

Cross-collection relations/lookups, formula columns, grouping/board (kanban)
layouts, real-time collaborative editing.
