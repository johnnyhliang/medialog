-- The Manager's per-topic state. See docs/manager-scope.md §3.
--
-- Purely additive: one new table, no `alter table` on anything that already
-- exists, no backfill. A topic with no row here is simply a topic you have
-- never written a next action for or parked — the Manager treats a missing row
-- as the empty state, so nothing needs migrating.
--
-- The upkeep budget for this feature is ONE line per active topic, which is why
-- `next_action` is the only human-written field on the card.
--
-- Deliberately NOT columns, contrary to the first sketch in
-- 2026-07-04-north-star-experience-design.md Part 2:
--   * `momentum`  — derived from the timestamps you already generate by using
--                   the app (see momentumFor() in src/lib/manager.js). Storing
--                   it would mean a background job to keep it fresh, and a
--                   stored momentum is a momentum that can be wrong.
--   * `last_entry_id` / `last_position` — likewise derived: the newest entry in
--                   the topic already IS "where you left off", and the deep-topic
--                   cursor (topics.cursor_section_id, migration 0042) already
--                   records position for the one case that has sections. A second
--                   copy would need writing on every navigation and would drift.

create table if not exists topic_state (
  topic_id    uuid primary key references topics on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  next_action text,
  -- non-null = parked. Parked is NOT archived: the topic stays in the Manager,
  -- in its own section, with the note visible, so ignoring it is a decision you
  -- can see and reverse.
  parked_at   timestamptz,
  parked_note text,
  updated_at  timestamptz not null default now()
);

alter table topic_state enable row level security;
create policy "topic_state: own rows" on topic_state
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists topic_state_user_id on topic_state (user_id);
