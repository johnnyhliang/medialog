# Living Topic Docs — Design Spec

**Date:** 2026-06-17
**Status:** Approved
**Branch:** feat/ai-infra
**Roadmap phase:** Phase 0 (fixes the active "notes get lost / topics get long" pain)
**Companion docs:** `2026-06-17-strategic-roadmap.md`, `2026-06-15-medialog-ultimate-vision.md`

---

## Overview

Each topic gains a **master markdown document** ("living topic doc") that lives at the
top of the topic page, above the scrollable entry list. The doc is freeform synthesis;
the entries are the raw saved items. The two are connected: you embed any entry inline
in the doc via a stable `[[entry:UUID]]` reference, typed through a `[[` autocomplete.
Embedded entries render as inline chips with a fast hover/long-press preview and
click-to-jump. Search is scoped (this topic / this doc / everything) with fast in-memory
fuzzy matching.

This is the "Synthesis" pillar of the vision and the Obsidian-killer move: the structure
of Obsidian (linked docs) without the manual-linking burden, inside a tool that already
captures and triages.

---

## 1. Data Model

### `topics` table — new column

```sql
alter table topics add column master_doc text not null default '';
```

No risk to existing rows — defaults to empty string.

### `entries` table — title always populated

`title` column already exists (nullable). Change: title is **always computed and stored**
on every create/update of an entry, in JS, using this resolution order:

1. First `# H1` heading in the note body
2. Else first non-empty line of the note, trimmed, capped at 120 chars
3. Else the entry's URL
4. Else `"Untitled"`

Stored as **raw title text** — never slugified, no dashes-for-spaces in the DB. Slugs are
a display concern generated on the fly if ever needed. Keeping raw text keeps search and
rename clean.

Existing entries keep their current title until next save, at which point it recomputes.
A one-time backfill is **not** required (titles already exist from the enrich flow); new
saves converge to the rule.

### Embed reference format (stored inside `master_doc` markdown)

```
[[entry:UUID]]            → renders as the entry's current title
[[entry:UUID|label]]      → renders with a custom display label
```

UUID-based so renames and title collisions never break a reference.

---

## 2. Title Computation

**File:** `src/lib/entryTitle.js`

```
computeTitle(note: string, url: string | null) → string
```

Logic:
- Match first line beginning with `# ` (one hash + space) → use its text
- Else first non-empty trimmed line, sliced to 120 chars
- Else `url` if present
- Else `'Untitled'`

Called inside `createEntry` and `updateEntry` in `src/lib/db/entries.js` when `note` is
part of the write, setting the `title` column.

**Precedence rule (unambiguous):**
- If the note has text → recompute title from the note (rules 1–2 above). This always wins
  when note text is present.
- If the note is empty → use an explicit `title` argument if provided (e.g. enrich's fetched
  page `<title>` for a URL-only entry), else the URL, else `"Untitled"`.

So note text always overrides a stale enriched title; enrich's title only persists while the
note stays empty.

---

## 3. Master Doc Editor & `[[` Autocomplete

### Editor

Reuses the existing CodeMirror-based `NoteEditor` component (write/preview/split modes,
smart punctuation from the file-preview plan). A topic-level wrapper component
`TopicDocEditor` owns:
- Loading `topics.master_doc` into the editor
- Debounced autosave (800ms, same pattern as note autosave) → `updateTopicDoc(supabase, topicId, doc)`
- Rendering preview mode with embed chips (Section 4)

**New DB function** in `src/lib/db/topics.js`:
```
updateTopicDoc(supabase, topicId, masterDoc) → updated topic row
```

### `[[` autocomplete

A CodeMirror autocomplete extension (`@codemirror/autocomplete`).

- Trigger: typing `[[`
- Candidate source: an in-memory index `{ id, title, topicId, topicName }[]` loaded once
  when the topic opens (current topic's entries always; all topics' entries loaded lazily
  if the user widens scope)
- **Scope default: current topic.** Dropdown header shows a scope toggle; widening to "all
  topics" shows each cross-topic candidate with its topic name as a badge
- Fuzzy match: subsequence match, ranked by (title-prefix match > recency)
- Select → inserts `[[entry:UUID]]`; if the user had typed a display label first, inserts
  `[[entry:UUID|label]]`
- Arrow keys navigate, Enter selects, Esc dismisses

No per-keystroke network calls — matching is entirely in-memory.

### Write vs preview

- **Write mode:** `[[entry:UUID]]` shown as raw text (editable)
- **Preview/rendered mode:** tokens become live embed chips

---

## 4. Embed Chips & Hover Preview

### Parsing

Before passing `master_doc` to `ReactMarkdown`, a pre-processor (or small remark plugin)
finds `[[entry:UUID]]` / `[[entry:UUID|label]]` tokens and replaces them with a custom
element the markdown renderer maps to `<EntryEmbed entryId=... label=... />`.

### Chip

Inline element showing the entry's **current title** (looked up from the in-memory entry
index by UUID) + a type icon derived from the entry URL via `classifyUrl` + youtube check:
- 🎥 YouTube · 📄 file (pdf) · 🖼 image · 🔗 web link · 📝 note-only

### Hover (PC) / long-press (mobile) → preview popover

Anchored to the chip. **Never blocks on network.** Content priority:

1. **Media (network, optional):** image URL → thumbnail; YouTube → thumbnail (deterministic
   CDN, no fetch); file → file chip; generic website → cached link-preview card reusing
   `fetchLinkPreview` data
2. **Text (always, in-memory):** the entry note's top section — up to the first heading
   break or ~200 chars
3. **Offline / no network:** media is skipped; text-only popover still renders instantly

The popover renders in-memory text immediately, then media fills in asynchronously if it
loads. A slow or broken image never delays or blocks the popover.

### Tap / click → jump

- Scrolls the entry list to that entry and briefly highlights it (`#entry-{id}` already
  exists as an anchor on `EntryCard`)
- A floating **"↑ Return"** button (pinned bottom-corner) appears, capturing the doc scroll
  position; clicking it scrolls back to the exact prior position. Auto-dismisses once the
  user returns or scrolls away manually.

### Missing entry

If the UUID resolves to no entry (deleted), the chip renders greyed-out as
`⚠ missing entry` — the doc never breaks.

---

## 5. Page Layout & Scoped Search

### Topic page structure (top → bottom)

```
┌─────────────────────────────────────────────┐
│  Topic Name                      [Doc ⇄ List] │
├─────────────────────────────────────────────┤
│  MASTER DOC (rendered; ✎ to edit)             │
├─────────────────────────────────────────────┤
│  🔍 Search in this topic…        [⌄ scope]    │
├─────────────────────────────────────────────┤
│  QuickAdd                                     │
│  Entry cards (scrollable list)                │
└─────────────────────────────────────────────┘
```

### View toggle (Doc ⇄ List)

- **List mode:** master doc collapsed; entries only (today's behavior)
- **Doc mode:** master doc expanded above entries
- Per-topic preference stored in `localStorage` (key `medialog_topic_view_{topicId}`)
- New/empty topics default to **List** so they don't feel barren

### Scoped fuzzy search

Search bar gains a scope selector:
- **This topic** (default) — fuzzy over title + note text of current topic's entries
- **This doc** — only entries embedded in the current master doc (find where you referenced something)
- **Everything** — global (current behavior)

Same in-memory fuzzy scorer as the autocomplete. Filters the entry list live.

**File:** `src/lib/fuzzyFind.js` — `fuzzyFind(query, items, keys) → ranked items`. Pure,
unit-tested, no dependencies.

---

## 6. Files Changed / Created

| File | Change |
| :--- | :--- |
| `supabase/migrations/0007_master_doc.sql` | New — add `master_doc` column |
| `src/lib/entryTitle.js` (+ test) | New — `computeTitle` |
| `src/lib/fuzzyFind.js` (+ test) | New — fuzzy scorer |
| `src/lib/db/topics.js` | Add `updateTopicDoc` |
| `src/lib/db/entries.js` | Compute + store title on create/update |
| `src/components/TopicDocEditor.jsx` | New — master doc editor wrapper |
| `src/components/EntryEmbed.jsx` | New — chip + hover preview + jump |
| `src/components/ReturnButton.jsx` | New — floating return-to-position button |
| `src/components/TopicView.jsx` | New — composes doc + search + entry list + toggle |
| `src/components/MarkdownView.jsx` | Add `[[entry:]]` token → `EntryEmbed` mapping |
| `src/components/NoteEditor.jsx` | Accept optional `[[` autocomplete extension |
| `src/App.jsx` | Render `TopicView` for browse; load entry index for embeds/autocomplete |
| `src/styles.css` | Chip, popover, return button, layout styles |

---

## 7. Dependencies

- `@codemirror/autocomplete` — CodeMirror 6 autocomplete (same family as installed CM packages)

---

## 8. Forward-Looking (NOT built in this plan)

- **Semantic / topical LLM search:** the search scope selector is designed to later gain a
  "Related (AI)" mode that retrieves entries by meaning/topic via embeddings, not exact
  text. This is **Phase C** of the strategic roadmap. The LLM integration should be able to
  find roughly-related entries by topic rather than literal text match. Out of scope here;
  noted so the scope-selector UI anticipates it.
- **AI-auto-drafted master docs:** later, the AI synthesizes entries into a starting master
  doc. This spec builds only the manual/human-authored doc + embedding layer it will write into.

---

## Non-goals

- No nested topics / subtopics (flat topics stay flat — philosophy)
- No AI synthesis of the doc (Phase C)
- No semantic search implementation (Phase C; only UI-anticipated)
- No real-time collaboration
- No backfill migration of titles (converges on save)
