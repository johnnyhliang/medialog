# Periodic Digest Design

**Date:** 2026-06-21
**Phase:** B
**Status:** Spec / not yet planned

## Goal

A weekly in-app summary that surfaces what you captured, what you completed, and what's been sitting in backlog too long — so the app stays alive and useful rather than becoming another graveyard.

## What the digest shows

**This week:**
- N entries captured across X topics
- N entries marked done (with titles — the achievement list)
- N entries moved from backlog → active

**Needs attention:**
- Entries in `backlog` status older than 60 days (stale — decide or delete)
- Topics with no activity in 30 days (dormant — still relevant?)
- Inbox entries older than 14 days (un-triaged — Sort Inbox them)

**Reading queue snapshot:**
- Top 5 `active` entries by age (oldest first — what are you actually reading?)

## Delivery

**In-app view only** — a "Digest" nav item or a section on the Home dashboard. No email for now (no email sending infrastructure, and you're the only user).

The digest is computed on demand when you open it, not pre-generated. Supabase queries over the entries table with date filters — no new schema needed.

A "last generated" timestamp is stored in localStorage so the nav item can show a "new" badge if you haven't opened it this week.

## Architecture

- `src/components/DigestView.jsx` — renders the digest sections
- `src/lib/db/digest.js` — `computeDigest(supabase, since)` → returns all digest data in one object
- Nav item in sidebar: "Digest" (or surface as a section inside HomeView)
- No new DB tables — all queries are over existing `entries` and `topics` tables

## Queries needed

```js
// Entries created in the last 7 days
// Entries where status changed to 'done' in last 7 days (need updated_at + status)
// Entries with status='backlog' and created_at < now - 60 days
// Topics with no entries updated in last 30 days
// Entries in Inbox topic older than 14 days
// Entries with status='active' ordered by created_at asc, limit 5
```

Note: "status changed to done this week" requires `updated_at` which already exists on entries. Not perfect (updated_at changes on any edit) but good enough approximation.

## Constraints

- Computed on demand, not cached or scheduled
- No email delivery — in-app only for v1
- Read-only view — links to the relevant entries/topics for action, doesn't mutate anything
- Weekly cadence is the default frame but the view should let you pick "last 7 days / 30 days / all time"
