-- The contribution grid. See docs/manager-scope.md §6.
--
-- A LOG, NOT A STREAK. gains-system.md is explicit that "there are no dates and
-- no 'behind'", and the dead-day floor exists so a bad day still counts. A grid
-- of what happened matches that; a "🔥 0 days" counter contradicts it. A streak
-- number may be derived from these rows and shown small — it is never stored,
-- because a stored streak is a streak that can be broken by a bug.
--
-- A CONTRIBUTION IS OUTPUT, NOT INTAKE. Only two events write here:
--   'step'  — a master_doc checkbox was flipped from [ ] to [x]
--   'done'  — an entry was moved to status 'done'
-- Saving a link is deliberately NOT a contribution. If capture counted, the grid
-- would measure how much you pasted and could be gamed by pasting more, and a
-- dishonest grid is not motivating.
--
-- Deliberately absent, per §6 ("one table, no recurrence rules, no completion
-- state, no broken-streak state"):
--   * no recurrence / schedule columns — this records what happened, never what
--     is supposed to happen. The moment it holds intent it is a nag list.
--   * no `count` column — one row per contribution; the grid aggregates. A
--     counter would need incrementing, which is a write that can be wrong.
--   * no `value`/`weight` — every contribution is worth exactly one. Weighting
--     is a priority system, and manager-scope §2 exists to avoid hand-ranking.
--
-- The column is `day`, not `date` as sketched in §6: `date` is a type name and
-- reads badly in every query that touches it. Same field, better name.

create table if not exists contributions (
  id         uuid primary key default gen_random_uuid(),
  -- `default auth.uid()` rather than the auth.getUser() round-trip that
  -- managerState.js does: these writes are fire-and-forget on the hot path of
  -- ticking a checkbox, and an extra request there is latency the user feels
  -- for a row they are not waiting on. Same pattern as `applications` (0044).
  user_id    uuid not null references auth.users on delete cascade default auth.uid(),
  -- The local calendar day the contribution happened on, resolved through the
  -- user's timezone preference (user_configs.timezone, migration 0073) rather
  -- than UTC. A grid drawn in UTC puts evening work on tomorrow's square.
  day        date not null,
  -- set null, not cascade: deleting a topic must not rewrite history. The square
  -- stays; it just loses its label.
  topic_id   uuid references topics on delete set null,
  kind       text not null check (kind in ('step', 'done')),
  -- What was finished, denormalised on purpose: the step text lives inside a
  -- master_doc that gets rewritten, and the entry may be deleted later. Without
  -- a copy the grid can show a square it cannot explain.
  note       text,
  created_at timestamptz not null default now()
);

alter table contributions enable row level security;
create policy "contributions: own rows" on contributions
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The only read pattern: "my last N days", newest first.
create index if not exists contributions_user_day on contributions (user_id, day desc);
-- Unchecking a box deletes its row (see recordStep/unrecordStep in
-- src/lib/db/contributions.js) — that lookup is by (user, day, kind, note).
create index if not exists contributions_undo on contributions (user_id, day, kind);
