# Career Section — Design Spec

**Date:** 2026-06-26  
**Status:** Approved — ready for writing-plans

---

## Problem

Career-related tooling is scattered across three disconnected nav items (Opportunities, Applications, and an unbuilt Watchlist) with no unified entry point. Opportunity data was polluted with stale HN/Twitter sources. The `programs` table has no UI. Applications is buried.

---

## Solution

A permanent **Career** sidebar item — a second first-class citizen directly below Inbox, identical in treatment (not a regular topic, not pinnable/archivable). Inside: three tabs.

---

## Sidebar

- Career appears below Inbox, above the topic divider
- Same visual weight as Inbox (icon + label)
- Icon: `Briefcase` (lucide-react)
- No unread badge on the sidebar item itself — unread count lives on the Radar tab

---

## Tab 1: Radar (default)

The existing `OpportunityView` component, moved in. No functional changes except:
- Remove from top-level nav
- Add unread count badge on the tab label
- Filter pills: All / SWE / Quant / PM / Fellowship / Saved / Unread (HN + Twitter pills already removed)
- "→ Track" button sends to Applications tab (already wired via `onTrack` prop)

Data source: GitHub boards (8 repos, cron-refreshed). Old HN/greenhouse/lever/ashby/twitter rows already deleted from prod.

---

## Tab 2: Watchlist

New UI over the existing `programs` table.

**What it shows:** Programs you manually track that aren't open yet — fellowships, research positions, competitive programs with annual application cycles.

**Each row displays:**
- Program name
- URL (linked)
- Notes (free text, shown truncated, expand on click)
- Expected open date (optional — if set, shown as "Opens ~[month year]")
- Status badge: `open` (green) / `closed` (muted) / `unknown` (grey) — from `programs.window_open` + `fetch-programs` cron

**Sort order:** By `opens_at` ascending (soonest first). Rows with no date at the bottom, alphabetical.

**Search:** Full-text across name + notes fields (client-side filter, no DB round-trip needed).

**Add form fields:**
- Name (required)
- URL (required)
- Notes (optional, textarea)
- Expected open date (optional, date input)

**When fetch-programs detects a program opened:** The row gets the `open` status badge and sorts to the top above all closed/unknown items.

**Schema addition needed:** `opens_at date` column on `programs` table (nullable). Migration required.

---

## Tab 3: Applications

The existing `ApplicationsView` component, moved in unchanged. Remove from top-level nav.

---

## Navigation Changes

- Remove `opportunities` and `applications` from the top-level left nav
- Add `career` nav item below Inbox in the sidebar (not in the icon nav — in the topic list area)
- `view = 'career'` with `careerTab` state (`'radar' | 'watchlist' | 'applications'`)
- The "→ Track" button in Radar sets `careerTab = 'applications'` and passes prefill (already works via `onTrack` prop pattern)

---

## Data Model

**Existing `programs` table** (already exists):
```sql
id, user_id, name, url, window_open, deadline, created_at
```

**New column needed:**
```sql
alter table programs add column if not exists opens_at date;
```

No other schema changes required. Opportunities table unchanged.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/CareerView.jsx` | New — tab shell, owns tab state |
| `src/components/WatchlistTab.jsx` | New — programs UI |
| `supabase/migrations/0037_programs_opens_at.sql` | New — adds opens_at column |
| `src/App.jsx` | Add `career` view, wire CareerView, remove opportunities/applications from nav, pass onTrack |
| `src/styles.css` | Career tab styles, watchlist row styles |

`OpportunityView.jsx` and `ApplicationsView.jsx` — no changes, just re-used inside CareerView.

---

## Out of Scope

- Automatic resurfacing of watchlist items in Revisit queue (future)
- PM repo (no valid public aggregator found yet)
- Social/Discord scraping
- Any changes to how fetch-programs works internally
