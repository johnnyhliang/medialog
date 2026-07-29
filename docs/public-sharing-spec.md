# Public Sharing — Scoping Spec

Status: **scoping, not built.** Goal: make individual entries (and later topics / synthesis
outputs) publicly viewable via an unguessable link, with a central manager in Settings to flip things
public/private. Shared pages are **fully rendered, read-only, no login**. Removing an item from the
list = it goes private immediately.

Today nothing is publicly shareable — all data is owner-scoped by RLS, and entries aren't even
URL-addressable (navigation is in-app state only). So this is greenfield.

---

## Core model — a share registry

One table is the source of truth for "what's public." A registry (not a boolean on each table) makes
the unified manager trivial and keeps it extensible to new shareable kinds.

```sql
create table shared_items (
  slug        text primary key,          -- unguessable public token (nanoid, ~16 chars)
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null,             -- 'entry' | 'topic'  (future: 'synthesis')
  ref_id      uuid not null,             -- entry_id or topic_id
  title       text,                      -- snapshot label for the manager list
  created_at  timestamptz not null default now(),
  unique (user_id, kind, ref_id)         -- one share per item
);
-- RLS: owner manages their own registry rows (the manager list reads this).
-- Anonymous visitors NEVER read this table directly — see serving model.
```

**Toggle semantics:** share = insert a row (generate slug). Unshare = delete the row. No `is_public`
column anywhere — absence from the registry *is* private (matches "take it off the list → default
private"). Deletion is instant, so the public page 404s the moment it's removed.

---

## Serving model — edge function, not loosened RLS  ★ security decision

The safest design: **do not** add public-read RLS policies to `entries`/`topics`. Instead a single
unauthenticated edge function `public-share` is the only public door:

1. `GET /functions/v1/public-share?slug=<slug>` (no auth).
2. Function looks up the slug in `shared_items` (service role). If missing → 404.
3. Fetches the referenced entry/topic (service role) and returns **only whitelisted, rendered
   fields** — title, note markdown (or pre-rendered HTML), created date, and a display name. Never
   `user_id`, email, internal flags, SRS data, etc.
4. Basic rate-limit + cache headers.

Why this over RLS: the `anon` key never touches the real tables, the exposed shape is explicit and
auditable, and unshare is enforced in one place. RLS-based public read would leak whole rows and
couple every future column to the share surface.

---

## Public page — a dedicated `share.html` entry

Add a third Vite entry (`share.html` → `src/share.jsx`) alongside `index.html`/`app.html`:

- Loads **no app shell, no auth, no Supabase session** — just fetches `public-share` by slug and
  renders the markdown read-only (reuse `MarkdownView`).
- Fast, cheap for anonymous visitors, and gets proper **OpenGraph/meta tags** so links preview
  nicely in iMessage/Discord/Twitter (title + snippet). Link previews are the whole point of sharing.
- URL scheme: **`/s/<slug>`** (pretty) via a Vercel rewrite → `share.html`. Fallback if we want zero
  routing config: `share.html?s=<slug>`.

Attachment images inside a shared note are the one wrinkle: uploaded images use **expiring** signed
URLs. Options — the function re-signs them with a long TTL at render time, or proxies them. (Hotlinked
external images and Phase-1 archived copies just work.)

---

## Settings → "Shared" manager

A new Settings section listing every `shared_items` row:

- Columns: title · kind · public URL · shared date.
- Per row: **Copy link**, **Open** (the rendered public page), and a **Public/Private toggle**
  (toggling off deletes the registry row → instantly private).
- A **read-only preview** inline (rendered, non-editable) so you can see exactly what the public sees.
- Empty state explains the model ("nothing is public until you share it").

Plus the **entry point at the item**: a "Share" button on an entry (and later a topic) that creates
the registry row, generates the slug, and copies the link. The manager is the central list; the
per-item button is how things get onto it.

---

## Related: entry permalinks (private, in-app)

Distinct from public shares. `app.html?entry=<id>` opens the entry's topic and scrolls to it, reusing
the existing `pendingEntryScroll` machinery — still behind auth. This makes in-app "copy link to
entry" work across devices for **you**; public sharing is the unguessable-slug, no-auth path. Build
them together since they're both "addressable entries," but keep the URL spaces separate (id vs slug).

---

## Open decisions (need your call)

1. **URL scheme** — `/s/<slug>` (pretty, one Vercel rewrite) vs `share.html?s=<slug>` (zero config).
   Recommend `/s/<slug>`.
2. **Topic sharing depth** — a shared topic renders its master doc **plus its entries inline** as one
   read-only page? Or just the master doc + a list of titles? Recommend: master doc + entries inline
   (that's the useful artifact), entries within not independently public unless separately shared.
3. **Shareable kinds for v1** — entries only first, topics next? Or both at once? Recommend entries
   first (smaller surface), then topics, then synthesis outputs.
4. **Attachment images in shares** — long-TTL re-sign vs proxy through the function. Recommend
   re-sign at render (simplest, no bandwidth through the function).

---

## Build order

- **A. Foundation** — `shared_items` table + RLS (owner-manages-own) + `public-share` edge function +
  slug generation (`nanoid`). Verify anon can fetch a shared entry and *cannot* fetch an unshared one.
- **B. Public page** — `share.html` + `src/share.jsx` read-only viewer + OG tags + `/s/<slug>` rewrite.
- **C. Share button** — on entries: create/delete registry row, copy link.
- **D. Settings manager** — the "Shared" list with toggle / copy / open / preview.
- **E. Topics** — extend kind='topic' rendering.
- **F. Entry permalinks** — `?entry=<id>` in-app deep link (private).

A–D is the shippable core (entries public + manager). E–F are fast follow-ons.
