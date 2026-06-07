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

## Org model — flat topics + tags

- **Topics are flat.** No parent/child nesting (nesting is what created the
  Obsidian mess). Examples: `AI`, `Fitness`, `Film`.
- Each entry belongs to **exactly one topic**.
- **Tags** are optional, cross-cutting labels for retrieval across topics.

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
  note             text not null default ''
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
Revisit feed, magic-link auth, iOS Shortcut capture, static PWA deploy.

### Out of scope (v1)
Subtopics/nesting, offline write queue, push notifications, multiple links per
entry, sharing/collaboration, long-form/structured notes (those stay on iPad).
