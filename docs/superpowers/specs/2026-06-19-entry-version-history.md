# Entry Version History — Spec

**Date:** 2026-06-19
**Status:** Idea / Future Consideration
**Inspiration:** Google Docs revision history

---

## Goal

Give every entry a reviewable, restorable timeline of its past states — without storing every keystroke or bloating the database.

---

## What Already Exists

- `entry_versions` table with full-snapshot on status change to `done`
- Restore UI already exists (🕘 icon)

This spec extends that foundation into a general version history system.

---

## The Core Principle: Session-Based Snapshots

A version is created when a **meaningful boundary** is crossed, not on every change. Three triggers:

### 1. Status Change (already implemented)
Snapshot whenever status transitions (backlog→active, active→done, etc.). These are natural milestones.

### 2. Session End
If content has changed since the last snapshot AND the last edit was >30–60 minutes ago, save a version on blur/close. This captures "I sat down and worked on this entry" as one version, not 47 intermediate saves.

- Implementation: debounced on `blur` event of the editor — check `updated_at` of latest version vs now, diff the content, snapshot if both conditions met
- The time threshold is tunable; 30 min is a reasonable default

### 3. Manual Checkpoint
A "save version" button (or command palette action) lets the user explicitly name and pin a snapshot — like Google Docs' "name this version." Named versions are never thinned.

---

## Thinning Strategy (anti-bloat)

Keep fine-grained recent history, coarsen older history automatically:

| Age | Retention |
|---|---|
| Last 7 days | Every snapshot |
| 7 days – 1 month | One per week (keep most recent of each week) |
| 1 month – 1 year | One per month |
| 1 year+ | One per year (or named checkpoints only) |

Named/pinned versions are always kept regardless of age.

A background job (or on-write trigger) runs the thinning pass. This keeps the table bounded: ~20–30 versions per entry in steady state.

---

## Storage Concern Is Smaller Than It Looks

Notes are short prose, not code. Even 20 full snapshots per active entry is ~20–50KB per entry. The thinning strategy is the real lever — you don't need hourly versions from 6 months ago. No diff compression needed; full snapshots are simpler to restore and still cheap at this scale.

---

## Git Is the Wrong Layer for This

GitHub backup = "export my whole library as portable plaintext" — a different job. Entry version history belongs in `entry_versions`. Mixing the two would make git history noisy (a commit per session across all entries) while making `entry_versions` redundant. Keep them separate.

---

## UI: Revision History Drawer

On the entry card/sheet, a clock icon (already exists) opens a right-side drawer:

```
Revision History
────────────────
★ Today, 2:30 PM       (current)
  Today, 11:05 AM
  Yesterday, 7:44 PM   [Status: Done]
  June 17
  June 15              [Named: "first draft"]
  June 12
  ...
```

- Each row shows: relative timestamp, optional label (status change / manual name)
- Click any row → preview that version's note in a read-only panel below the list
- One "Restore this version" button — creates a new snapshot of the current state first (so restore is non-destructive), then sets entry content to the selected version
- Named/pinned versions shown with a star or tag

---

## Schema Changes Needed

Current `entry_versions` likely just has `content` + `created_at`. Extensions needed:

```sql
ALTER TABLE entry_versions ADD COLUMN trigger text;        -- 'status_change' | 'session_end' | 'manual'
ALTER TABLE entry_versions ADD COLUMN label text;          -- user-supplied name for manual checkpoints
ALTER TABLE entry_versions ADD COLUMN pinned boolean DEFAULT false;  -- pinned = never thinned
ALTER TABLE entry_versions ADD COLUMN status text;         -- snapshot of status at time of version
```

---

## Implementation Order (when the time comes)

1. Add schema columns above
2. Wire the session-end trigger (debounced blur on editor, 30min threshold)
3. Build the drawer UI (timeline + preview panel + restore button)
4. Add thinning job (cron edge function or on-write trigger)
5. Add manual checkpoint (button + name prompt)

---

## Open Questions

- Should the drawer show diff (what changed) or just full previews? Full previews are simpler; diffs are more useful for long notes. Could do full preview first, diff as a later enhancement.
- Thinning threshold: 30 min session gap is a guess. Could be a user setting.
- Should version history be included in Markdown export? Probably not by default (bloat), but optionally.
