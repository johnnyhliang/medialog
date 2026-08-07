-- Reminders are entries, not a new table.
--
-- `docs/intentional-app-spec.md` Part 1: a reminder is an entry with a due date.
-- That single decision is what lets reminders inherit capture, topics, tags,
-- search, synthesis, archival, versioning and GitHub backup for free instead of
-- spawning a parallel pile with its own copy of each.
--
-- This pairs with `surface_after` (migration 0028), and the two are NOT
-- redundant — they are org-mode's SCHEDULED and DEADLINE:
--
--   surface_after = "don't show me this until then"  (hides the row)
--   due_at        = "this is actually due then"      (drives urgency)
--
-- An entry can have both: scheduled to appear Monday, due Friday.
alter table entries add column if not exists due_at timestamptz;

-- Partial index: the agenda only ever asks for rows that have a due date and
-- are not deleted, and those are a small minority of `entries`. Indexing only
-- them keeps the index small enough to stay cached, and Postgres can use it for
-- the ordering as well as the filter.
create index if not exists entries_due_at_idx
  on entries (due_at)
  where due_at is not null and deleted_at is null;
