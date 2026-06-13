# MediaLog — Design Spec

**Date:** 2026-06-07
**Status:** Approved design, pre-implementation

## Purpose

A PWA "media log" for capturing short notes and links under self-chosen topics —
installable on iPhone, equally usable on desktop, cloud-synced (no local-only
storage). It replaces a sprawling Obsidian markdown setup for *superficial,
short-form* material (ideas, links, takeaways). Longer/structured work (class
notes, etc.) stays on the iPad and is explicitly out of scope.

### Framing: the fourth bucket

MediaLog is one of four deliberate tools in a personal system, each with a clear
job:

- **Google Calendar** — time / events
- **TickTick** — tasks
- **Health tracker** (self-built) — health metrics
- **MediaLog** — things to *remember / read / reference* ← the missing bucket

The recurring principle: **a source is not a system.** Chrome tabs, Canvas, email
are inboxes; the system is the small set of tools you deliberately move things
into. MediaLog exists to absorb the "remember this" inputs that currently rot in
open browser tabs.

## Problems being designed against

The Obsidian mess came from four things; each maps to a design decision:

| Problem | Design response |
|---|---|
| Too many files/notes | No files — rows in a DB. Browse by topic/search, never folder trees. |
| No consistent structure | One fixed entry shape, enforced by the form. Malformed notes are impossible. |
| Friction to capture | ≤3-tap quick-add; iOS Shortcut for capture from any app; auto-fetched titles. |
| Stale & never revisited | "Revisit" feed surfaces least-recently-seen entries (anti-rot sweep). |

### Migration / onboarding (the existing backlog)

Getting the current pile (Chrome tabs, loose notes, YouTube links, articles) in
must be near-frictionless or the app dies on day one. Strategy, following
*source ≠ system*: **dump first, sort later.**

- **Track A — firehose dump:** bulk-paste a newline list of URLs (e.g. exported
  via the OneTab extension or "Copy All URLs") into a bulk-import box → one entry
  per line in the `Inbox` topic, titles auto-fetched in the background. Closes the
  tabs immediately.
- **Track B — incremental triage:** a "Sort Inbox" view presents untriaged entries
  one at a time to assign a topic / tag / note, or delete. Low-dose habit, same
  anti-rot muscle as the Revisit feed.

An entry is "untriaged" purely by virtue of living in the `Inbox` topic — no extra
column needed.

## Org model — flat topics + tags

- **Topics are flat.** No parent/child nesting (nesting is what created the
  Obsidian mess). Examples: `AI`, `Fitness`, `Film`.
- Each entry belongs to **exactly one topic**.
- **Tags** are optional, cross-cutting labels for retrieval across topics. Tags
  also carry **media kind** (`#book`, `#video`, `#course`, `#article`) — no fixed
  taxonomy field, so it stays flat and self-managing.

### Progress tracking (the "log" in MediaLog)

Tracking consumed media is the app's core purpose, not an add-on. Each entry has
an optional **consumption status** — `Backlog` (want to) → `Active` (consuming) →
`Done` (consumed, takeaways logged). This is distinct from task management
(TickTick's job): a `Done` entry is a **permanent record/achievement** kept with
its takeaways, not a chore that disappears. `status` also subsumes "archive" —
`Done` is the meaningful retire state.

A **topic progress view** groups a topic's entries by status with simple counts
(*"Done: 12 · Active: 3 · Backlog: 27"*). "Books read" = `Done` + `#book` in that
topic. No streaks/gamification — an honest tally of what was consumed and learned.

## Stack

- **Frontend:** React + Vite + `vite-plugin-pwa`. Pure client-side SPA.
- **Backend:** Supabase — Postgres, Auth, and one Edge Function. No server to
  maintain; generous free tier.
- **Hosting:** Static deploy (Netlify / Vercel / Cloudflare Pages — free).
- **Auth:** Single user. Supabase email/magic-link login, once per device; data
  syncs everywhere. Row Level Security scoped to the one user.

### Known platform constraint

iOS Safari does **not** support the Web Share Target API, so MediaLog cannot
appear in the native iOS share sheet. Workaround (designed for): a small **iOS
Shortcut** ("Add to MediaLog") that takes a shared URL + optional note and POSTs
to a Supabase Edge Function. This gives near-zero-friction capture from any app.

## Data model

```
topics
  id           uuid pk
  name         text not null unique
  created_at   timestamptz default now()

entries
  id               uuid pk
  topic_id         uuid fk -> topics.id
  url              text null
  title            text null         -- auto-fetched from url
  note             text not null default ''  -- markdown; holds takeaways
  status           text null  -- null | 'backlog' | 'active' | 'done' (consumption lifecycle)
  created_at       timestamptz default now()
  last_surfaced_at timestamptz null  -- drives the Revisit feed

tags
  id    uuid pk
  name  text not null unique

entry_tags
  entry_id uuid fk -> entries.id
  tag_id   uuid fk -> tags.id
  primary key (entry_id, tag_id)
```

All tables protected by Row Level Security tied to the authenticated user.

## Components

1. **Quick-add** — floating "+" button. Flow: paste/type link → note → topic
   (defaults to last-used) → save. ≤3 taps. Title auto-fetches in the background.
2. **Topic browse** — pick a topic, see its entries as Google-Keep-style cards
   (title/link + note + tags). Search box filters by text/tag across all topics.
3. **Entry card** — displays auto-fetched title as a tappable link, the note, and
   tag chips. Edit/delete inline.
4. **Revisit feed** — a "Revisit" tab listing entries by oldest `last_surfaced_at`
   (nulls first). Opening/marking an entry updates `last_surfaced_at`. No
   notifications in v1 (iOS PWA push is unreliable).
5. **Link-title Edge Function** — `GET /enrich?url=` → fetches the page, returns
   `{ title, site }`. Called on entry create/update. Also the POST target for the
   iOS Shortcut.
6. **Auth gate** — magic-link login; session persisted per device.
7. **Bulk import** — a textarea that splits input on newlines; each non-empty line
   becomes an `Inbox` entry (URL if it parses as one, else note text). Titles
   enrich in the background. The day-one migration tool.
8. **Sort Inbox** — lists entries in the `Inbox` topic one at a time; for each,
   assign topic / add tags / edit note, or delete. Triage flow for the backlog.
9. **`Inbox`** — a default/system topic that holds untriaged and quick-captured
   entries (also the iOS Shortcut's default landing topic).
10. **Markdown note body** — entry notes are markdown, rendered prettily on cards
    and the entry view (headings, bold, lists, links, **checkboxes**). Editing is a
    textarea with a live-preview toggle (functionality over WYSIWYG). Checkboxes
    cover lightweight project scoping without a parallel task system.
11. **Plain-text export** — an "Export" button downloads a `.zip` of markdown,
    **one `.md` per topic**, each entry a section with YAML frontmatter (url, tags,
    status, dates). Universal format, importable into any Windows editor
    (Obsidian/VS Code/Typora). On-demand download (a static PWA cannot write to
    disk on a schedule); a weekly in-app reminder nudges the export habit.
12. **Topic progress view** — per topic, groups entries by consumption `status`
    with counts; "books read" etc. = `Done` filtered by media-kind tag.

## Data flow

- Client reads/writes `topics`, `entries`, `tags`, `entry_tags` directly via the
  Supabase JS client (RLS enforces access).
- On entry save with a URL, client calls the Edge Function to populate `title`.
- iOS Shortcut → Edge Function (POST) → inserts an entry (topic defaults to an
  "Inbox" topic for later sorting).

## Error handling

- **Title fetch fails** (timeout, blocked, no `<title>`): save entry anyway with
  `title = null`; card falls back to showing the raw URL. Never block a save on
  enrichment.
- **Offline:** PWA shell loads from cache; writes queue is **out of scope for
  v1** (entries require connectivity). Surface a clear "offline — can't save yet"
  state rather than silently dropping.
- **Auth expired:** redirect to magic-link login, preserve any in-progress draft
  in memory.

## Testing

- **Unit:** entry-shape validation, tag parsing, Revisit ordering logic.
- **Edge Function:** title extraction across well-formed, title-less, and
  unreachable URLs.
- **Integration:** create → browse → edit → revisit round-trip against a Supabase
  test project.
- **Manual:** PWA install on a real iPhone; iOS Shortcut POST end-to-end.

## Scope

### In scope (v1)
Flat topics + tags, quick-add, card browse + search, auto-fetched link titles,
Revisit feed, magic-link auth, iOS Shortcut capture, static PWA deploy, `Inbox`
topic, bulk-paste import, Sort Inbox triage view, markdown note bodies +
checkboxes, consumption `status` + topic progress view, plain-text markdown export.

### Out of scope (v1)
Subtopics/nesting, offline write queue, push notifications, multiple links per
entry, sharing/collaboration, long-form/structured notes (those stay on iPad),
TODO/DONE task states (TickTick's job), priorities, backlinks, automated/scheduled
export, two-way TickTick/calendar integration (auxiliary roadmap).

## North Star — note to future me

V1 is intentionally small, but the long-term intent is bigger: MediaLog grows
into **my own personal system app** — a "Notion on steroids with the soul of
org-mode," fully native and tailored to how I actually work.

**The pillar is the buckets** — the notes/media-log itself (topics + entries) is
the core trunk of the whole system. Everything else — contact notes (networking),
calendar, health tracker, etc. — is **auxiliary**: modules that orbit and feed the
buckets, not co-equal pillars. Design decisions favor the buckets first; auxiliary
modules earn their place by serving them.

Guiding qualities, roughly in priority order:

- **Fast interfacing** — instant capture and navigation, no app lag, keyboard-
  and gesture-first. Speed is the whole point; if it's slow I won't use it.
- **Plain text underneath** — data stays in an open, portable, plaintext-friendly
  format I own and can grep/script/export. Never locked in a proprietary blob.
- **Fast fuzzy find** — one search box that fuzzy-matches across everything
  (notes, tasks, people, events) and jumps me there.
- **Built-in AI agent** — keeps persistent memory of my context, can execute
  tasks on my behalf, but **non-destructive by design** (no silent deletes/
  overwrites; mutations require confirmation or are reversible).
- **Unified dashboard** — one view that pulls together the buckets instead of me
  context-switching across apps.
- **People** — lightweight CRM / "people to talk to" layer (who to follow up
  with, context per person).
- **Calendar integration** — Google Calendar two-way or at least feed-in, so time
  lives next to tasks and notes.
- **Custom modules** — health tracker (absorb the self-built one), and room to
  bolt on bespoke tools as needs arise.
- **Native** — eventually a real native app, not just a PWA, for OS integration
  and speed.

The discipline that keeps this from becoming the mess it's meant to replace:
**source ≠ system**, flat over nested, one fixed shape per data type, and an
anti-rot resurfacing sweep baked into every module. Grow modules one at a time,
each earning its place — never a big-bang rebuild.

### Future feature idea — living topic documents (LLM interface)

Each topic gets a **living, breathing context document**: an auto-maintained
synthesis of everything in that bucket (its entries, links, takeaways, status).
Key properties:

- **Not user-edited** — it's maintained *for* you, regenerated/updated as the
  topic's entries change. It is the topic's memory, not another note to tend.
- **Tied to the topic** — one living doc per bucket, grounded only in that
  bucket's contents (buckets stay the pillar; the doc is an auxiliary view of
  them).
- **An LLM interface** — the doc is the quick context you **chat with an LLM
  about**. Ask "what have I concluded about X?", "what should I read next here?",
  "summarize my takeaways" — the model answers grounded in that topic's living
  document, not the open internet.

This is the concrete first form of the North Star's "built-in AI agent with
persistent memory": memory = the living docs (one per topic), the agent reads
them as context, and mutations stay non-destructive (it maintains the doc, never
silently rewrites your entries). Likely implementation later: a Supabase table
`topic_docs` (topic_id, generated_markdown, updated_at) refreshed on entry change
or on demand, plus a chat panel scoped to the selected topic.

**The agent can act, not just chat (tool use).** Beyond answering questions, the
LLM should *interface with the app's own features* through a defined tool layer —
e.g. sort the Inbox (assign entries to topics), set/clear consumption status,
add/remove tags, pin entries, and **flag backlog items as deletable** (mark
candidates for removal). Strict guardrail from the North Star: **non-destructive
by design** — the agent proposes destructive actions (delete, bulk reassign) and
the user confirms; only clearly reversible/safe actions (tagging, status, pinning,
surfacing) may run directly. Implementation later: expose the existing data-layer
functions (`updateEntry`, `setEntryTags`, `deleteEntry`, assign/pin) as agent
tools with a confirm gate on the destructive ones, so "clean up my AI backlog and
mark stale links for deletion" becomes a reviewable agent action.
