# Anti-Clutter & Entry Quality — Spec

**Date:** 2026-06-19
**Status:** Idea / Future Consideration
**Inspired by:** Instapaper, Pocket, Bear, Craft, Readwise Reader, Things 3, OmniFocus, Notion, Linear

---

## The Two Failure Modes

1. **Notes-free links** — link dumped with no context, guaranteed useless later
2. **Duplicate intent** — two entries that should've been one, or a link that belonged under an existing entry as a note/reference

Everything below addresses one or both.

---

## 1. Fuzzy Duplicate Detection at Capture (HIGH PRIORITY)

*Stolen from: Notion / Linear*

Before saving a new entry, check if the URL already exists in the library and surface it non-intrusively in the QuickAdd form:

- **Exact URL match** → inline warning: "You saved this on June 12 in **AI** — [view it]". Dismissible. Never blocks the save.
- **Fuzzy / domain match** → softer nudge: "You have 3 entries from `arxiv.org` in **AI** — [see them]". Helps catch "I've already read a version of this."

Implementation: query `entries.url` on input blur in QuickAdd, before submit. Show as a dismissible inline banner, not a modal. The fuzzy layer (same domain, similar title via string distance) can come after the exact-match version ships.

---

## 2. Empty-Note Visual Treatment on Aged Cards

*Stolen from: Instapaper (age anxiety), Pocket (visual decay)*

Cards with **no note AND older than ~2 weeks** get a distinct visual treatment — slightly faded, a small chip like `no notes · 18d`. Not alarming, just visible. Makes the graveyard obvious at a glance rather than hidden in the grid.

Pairs with the age display already on cards. The goal: create the instinct to either add a note or archive/delete, not let things silently rot.

---

## 3. Friction-as-Filter at Capture (Soft Note Nudge)

*Stolen from: Instapaper's save dialog*

The existing "What's worth remembering about this?" placeholder is good but skippable. Increase the soft pressure without adding a hard block:

- When note field is empty on save, show a one-line nudge below the button: *"No notes yet — why does this matter?"*
- The nudge disappears after any typing. Never a hard requirement — just friction.
- Alternative: only show the nudge if the URL is non-empty (pure-text entries are fine without notes)

---

## 4. Mandatory Takeaway Prompt on Done Transition

*Stolen from: Readwise Reader's archive prompt*

When marking an entry as **Done**, show a lightweight inline prompt:
> "Any final takeaway to add?"

- If note is already non-empty: pre-dismissed (show collapsed with a "add more" option)
- If note is empty: expanded by default, with the editor ready
- Never blocks the transition — user can dismiss and mark Done anyway
- This closes the retention loop at the natural moment: right when you've finished consuming

---

## 5. "Add to Existing Entry" Affordance in QuickAdd

*Stolen from: Bear / Craft (append to note)*

Secondary action alongside "Save new entry" in QuickAdd:

> **"Add to existing →"** → opens a fuzzy picker of recent/current-topic entries → appends the URL as a linked reference in that entry's note

Solves the case: "this link belongs with my existing entry about X, not as its own card." Same as the `[[` embed system already in the editor, just surfaced at capture time. Especially useful when in a topic that already has a canonical entry for a piece of media.

---

## 6. `maybe` as a Fourth Status

*Stolen from: Things 3's Someday bucket, OmniFocus's On Hold*

The backlog conflates "I definitely want to read this" with "this seemed interesting once." A fourth status `maybe` (between null/no-status and `backlog`):

- Hidden from the main Backlog view by default
- Surfaced only during Sort Inbox or a dedicated "maybe sweep" tab
- Keeps the active backlog meaningful without forcing a delete decision
- Cards in `maybe` could render with a lighter visual weight

Schema: extend the `status` enum with `'maybe'`. Filter it out of default backlog queries.

---

## 7. Entry Parent/Child Relationships (Lightweight Grouping)

*The structural fix for duplicate intent*

A simple `parent_entry_id` foreign key on `entries` — one entry is canonical, others are supplementary links or highlights that live under it. Not nesting topics (which violates the flat philosophy) — just linking entries within the same topic.

- Card shows linked children as a count chip: `3 related`
- "Make this a sub-entry of [other entry]" action on the entry menu
- Natural home for highlights when Phase A (highlight layer) ships — highlights are already designed as child entries linked to a source

This is Phase A territory in complexity; don't build it before the highlight layer is designed.

---

## 8. Alternative Views Beyond the Grid

*The grid is keepable and good for scanning. But other views unlock different workflows.*

### List / Dense View
Single-column, compact rows: title + tags + status chip + age. No card chrome. Good for large topics (400+ entries like the CS topic) where the grid becomes a wall. Already partially designed as a "density toggle" idea (see Tuxedo analysis).

### Kanban / Status Board
Columns: `Backlog | Active | Done`. Drag entries between columns to change status. Every read-it-later tool eventually builds this. Natural view for the "what am I working through right now?" question. Read.cv and Linear use this pattern well.

### Table / Spreadsheet View
Rows with sortable columns (title, topic, status, date, tags). Best for bulk triage and audit — "show me all backlog entries older than 6 months." Notion's table view is the reference. Pairs well with multi-select bulk actions.

### Timeline / Feed View
Entries sorted by `created_at` descending, infinite scroll, no grid chrome. "What did I save recently?" — a chronological reading of your capture history. Good for the Revisit feed too.

**Priority order:** List/Dense first (low effort, high need for large topics), Kanban second (natural fit for the status model), Table third (power-user audit tool), Timeline whenever.

---

## Interaction Between These Ideas

- Fuzzy duplicate detection + "Add to existing entry" together make capture smarter — detect the dupe, then offer to attach rather than create
- Empty-note visual treatment + Done takeaway prompt together close the loop — visible rot at the browse stage, forced reflection at the completion stage
- `maybe` status + List view together let you do a real "backlog audit" session — filter to maybe, scan in dense mode, promote or delete
- Entry parent/child + Kanban view together give you a lightweight project view for a topic

---

## Implementation Priority

| Feature | Effort | Impact | When |
|---|---|---|---|
| Fuzzy duplicate detection (exact URL) | Low | High | Soon — one query on QuickAdd blur |
| Empty-note visual treatment on aged cards | Low | High | Soon — CSS + age check |
| Done transition takeaway prompt | Low | High | Soon — modal on status change |
| Soft note nudge at capture | Low | Medium | Soon |
| List / dense view toggle | Low-Medium | High | After UI polish lands |
| "Add to existing entry" in QuickAdd | Medium | Medium | After capture UX stabilizes |
| `maybe` status | Medium | Medium | Phase 0.5 territory |
| Kanban / status board view | Medium | High | Phase 0.5 |
| Entry parent/child relationships | High | High | Phase A (with highlight layer) |
| Table / spreadsheet view | Medium | Medium | Phase A |
