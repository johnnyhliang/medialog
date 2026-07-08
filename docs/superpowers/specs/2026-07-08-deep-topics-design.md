# Deep Topics — Design Spec

**Date:** 2026-07-08
**Status:** Draft (for review)
**Part of:** the "Gains System" vision (`gains-system.md`). This is **sub-project 1 of 2**.
The **Gains Feed** (the "when bored" pull surface that replaces doomscrolling, absorbs the
interview tracker, and adds the menus/floors/capture-to-shelf philosophy) is a **separate later
spec** that builds on this one.

---

## Motivation

The app today has exactly one kind of topic: **breadth-first**, a Google-Keep-style grid of
scattered cards (links, quick notes) you *collect* around a subject. That's the wrong shape for
going *deep* through a single big resource — a book, a long paper, a dense article.

Deep work needs a different container: you move through **one resource in order**, chapter by
chapter, and what you write down are **takeaways** (the insight you can *use* later), not
summaries (a recap of what it said). `gains-system.md`'s Concept Bank already gestures at this
with its "next small chunk" cursor per resource.

**Deep Topics** add that second container. Breadth topics stay exactly as they are.

### Goals

- Read *through* a big resource chapter-by-chapter with a "you are here" cursor.
- Capture **takeaway-first** notes (insight primary, summary optional), organized by section.
- Follow a tangent depth-first without leaving the resource.
- Accommodate heterogeneous sources: a **book** (no digital file, just an outline), a **web**
  article, a **paper**, or an uploaded **PDF** — same reading shell over any of them.
- Stay **lightweight**: the outline is optional and grows *as you read*; never a pre-filled,
  slide-deck-intensive syllabus you owe.
- Reuse existing infrastructure (topics, entries, reader text, PDF viewer, attachment storage).

### Non-goals (explicitly deferred)

- **The Gains Feed** — the "when bored" one-at-a-time pull surface across resources. Separate spec.
- **AI auto-chunking (phase B)** — deriving an outline from a PDF TOC / article headings / an AI
  section list. Manual-first only here.
- **AI-gathered resources (phase C)** — "give a topic, AI assembles resources + chunks."
- **Interview-tracker absorption** — folding the just-built tracker in happens in the Feed spec.
- **"All in one place / easy to navigate back"** — a unified Gains home is future work.

The schema below is designed so all of these bolt on without a rewrite.

---

## Data model

Reuses `topics` and `entries`; a `kind` flag on each topic selects the renderer, so breadth
topics are untouched.

### `topics` (additions)

| Column | Type | Meaning |
|---|---|---|
| `kind` | `text not null default 'note'` | `'note'` = breadth (Keep grid, existing) · `'deep'` = resource |
| `source_kind` | `text` | `'book' \| 'web' \| 'paper' \| 'pdf'` (null for breadth). `'book'` = no digital file: outline + notes only |
| `source_url` | `text` | URL for `web`/`paper` sources (null otherwise) |
| `source_path` | `text` | storage key for an uploaded `pdf` (reuses the existing private attachments bucket) |
| `cursor_section_id` | `uuid` | the section the reader is currently on (nullable) |

Existing `master_doc` is unused by deep topics for now (kept for breadth living-docs). `full_text`
handling for a `web` source reuses the existing reader-mode extraction.

### `resource_sections` (new table — the chapter outline)

```
id            uuid pk
user_id       uuid not null            -- RLS
topic_id      uuid not null references topics on delete cascade
position      int not null             -- ordering within the resource
title         text not null            -- e.g. "§3.2 Adverse selection"
status        text not null default 'todo'   -- 'todo' | 'reading' | 'done'
created_at    timestamptz default now()
```

RLS: own rows. Index on `topic_id`. Sections are added one line at a time as the reader reaches
them; an empty outline is valid (a brand-new resource has zero sections until you add the first).

### `entries` (additions — takeaway-first notes)

| Column | Type | Meaning |
|---|---|---|
| `section_id` | `uuid references resource_sections` | which chapter this note belongs to (null for breadth entries) |
| `takeaway` | `text` | the **primary** field for a deep-topic note: the insight you can use |
| `parent_id` | `uuid references entries(id)` | depth-first tangent: a takeaway nested under another |

A deep-topic note is an entry with a `takeaway` (headline insight) and, optionally, its existing
`note` field used as the summary/quote/body beneath it. `title` is not auto-computed for these
(the takeaway is the headline). Breadth entries set none of these three columns and behave exactly
as today.

**Why reuse `entries` rather than a new table:** takeaways inherit export, search, embeddings,
soft-delete/trash, and versions for free — and the eventual Gains Feed can resurface takeaways
through the same machinery it already knows.

---

## The reading loop (how it's used properly)

This *is* the "consume content the right way" workflow:

1. **Add a resource** — name it, choose a source: paste a URL (`web`/`paper`), upload a PDF
   (`pdf`), or just name a book (`book` — no file). Optionally type the first section; usually leave
   the outline empty.
2. **Open it** — a two-pane reading view: the **source** on one side (reader text for `web`, the
   existing `PdfViewer` for `pdf`, nothing for `book`), the **section outline** + your
   **cursor** on the other.
3. **Read the chunk at the cursor**, then write **one takeaway** (primary). Summary/quote optional.
4. **Advance the cursor** to the next section — adding that section in one line if it doesn't exist.
5. **Tangent?** Add a takeaway nested (`parent_id`) under the current one — depth-first, without
   leaving the resource.
6. The resource's **"what I learned"** view = all takeaways in section order: the compounding pile.

Discipline the design enforces by shape: takeaways are the primary input (summaries are secondary),
one section is "current" at a time, and the outline only ever grows from where you actually are.

---

## Components & reuse

- **`DeepTopicView.jsx`** (new, lazy-loaded) — the two-pane reading/notes view for `kind:'deep'`
  topics. Renders source pane + outline + cursor + current-section takeaways + "add takeaway" +
  "advance cursor" + nested-tangent add. A "what I learned" tab lists all takeaways in order.
- **Source panes (reuse):** `ReaderModal`/reader text for `web`/`paper` (existing `full_text`
  extraction via `enrich`); `PdfViewer` for `pdf`; none for `book`.
- **PDF upload (reuse):** existing private attachments storage bucket; store the key in
  `topics.source_path`.
- **`src/lib/db/deepTopics.js`** (new) — helpers: `createDeepTopic`, `listDeepTopics`,
  `getDeepTopic` (topic + sections + takeaways), `addSection`, `setCursor`, `setSectionStatus`,
  `addTakeaway`, `updateTakeaway`. Takeaway writes reuse the `entries` table.
- **`listTopics` filter:** exclude `kind = 'deep'` from the breadth topic list/sidebar/grid (same
  pattern already used to hide interview pattern-topics), so deep topics don't pollute the Keep grid.
- **Navigation:** a new nav item — **"Reading"** (working name; becomes part of the Gains surface
  later) — lists deep topics and opens `DeepTopicView`. Creating one is a "New deep topic" action
  in that view.

### Schema migration

`supabase/migrations/0042_deep_topics.sql`, in order: (1) add the `topics` columns *except*
`cursor_section_id`; (2) create `resource_sections` + RLS + `topic_id` index; (3) add
`topics.cursor_section_id uuid references resource_sections(id) on delete set null`; (4) add the
`entries` columns (`section_id` FK → `resource_sections`, `takeaway`, `parent_id` FK → `entries`).
Order matters so every FK target exists first.

### Testing

- `deepTopics.js` db helpers (mocked supabase): create, list, add section, set cursor, add
  takeaway, nested tangent.
- `DeepTopicView` component: renders sections + cursor, adds a takeaway, advances the cursor,
  renders the "what I learned" ordering. Follows the existing vitest + mockSupabase patterns.

---

## Out of scope / future work (named, not designed here)

- **Gains Feed (Spec 2):** one-at-a-time "when bored" pull across active resources; menus-as-
  fridges, dead-day floor, two-active cap, capture-to-shelf; absorbs the interview tracker.
- **Phase B — AI/algorithmic auto-chunking (confirmed direction):** derive/suggest the section
  outline from a PDF TOC, a `web` source's headings, or an AI section list, so manual outlining
  disappears. User likes auto-suggest but wants it here, not in the MVP.
- **Phase C — AI-gathered resources:** "give a topic → AI assembles resources + chunks + draft
  takeaways."
- **Unified Gains home** with easy back-navigation across resources (user's stated future want).

## Open questions

- Nav name: "Reading" vs "Resources" vs "Deep" for the MVP surface (cosmetic; decide at build).
- ~~Auto-suggest sections from headings in the MVP?~~ **Resolved: no.** Auto-suggest is wanted but
  deferred to phase B (see future work); the MVP is purely manual outlining.
- PDF page-range as a section hint (e.g. "§ = pages 40–58")? Optional `note` on the section for now;
  no dedicated field in v1.
