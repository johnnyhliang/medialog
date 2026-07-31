-- entries never had an updated_at column (base schema in 0001_init.sql only
-- has created_at/last_surfaced_at), but real queries across the app assume it
-- exists: Tidy's stale-backlog query, Digest's "completed" query, the Home
-- Review Summary widget, Revisit's age display, listRecentActivity (which
-- also feeds Feed's relevance ranking), and the interview tracker's pace
-- math. Every one of those queries has been failing with "column entries
-- .updated_at does not exist" — wiping out whichever view depends on it,
-- which is how the interview tracker appeared to lose all its data.
--
-- Fixing every callsite to use created_at instead would silently change their
-- meaning (Tidy's "untouched 41 days" should mean last touched, not first
-- created) — adding the column for real, with a trigger to keep it current,
-- fixes every caller at once without touching their query code.

alter table entries add column if not exists updated_at timestamptz;
update entries set updated_at = created_at where updated_at is null;
alter table entries alter column updated_at set not null;
alter table entries alter column updated_at set default now();

create or replace function touch_entries_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_entries_updated_at on entries;
create trigger trg_entries_updated_at
  before update on entries
  for each row execute function touch_entries_updated_at();

create index if not exists entries_user_updated_idx on entries (user_id, updated_at);
