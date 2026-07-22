-- Multi-tenant RLS audit fixes (blocker: "RLS / multi-tenant audit", PRODUCTION.md).
--
-- The app grew up single-user, so several career-section tables have no owner
-- column and are readable/writable by ANY authenticated account. Before a second
-- person signs in:
--
--   1. `applications` is personal pipeline data with no user_id  → owner-scope it.
--   2. `opportunities.is_read/is_saved` is per-user state stored on a globally
--      shared row → one user marking an item read changes it for everyone.
--      Moved to a per-user side table.
--   3. `opportunities` / `programs` / `companies` are shared reference data that
--      any authenticated user could rewrite or delete → read-only for users;
--      the fetch cron writes with the service role, which bypasses RLS.
--   4. storage `attachments` allowed ANY authenticated user to read EVERY user's
--      objects (select was scoped to the bucket, not the owner folder).

-- ── 1. applications: owner-scoped ────────────────────────────────────────────
alter table applications add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Backfill: while this project is still single-user, existing rows belong to the
-- only account. If more than one account already exists, this is a no-op and the
-- orphan rows stay invisible until assigned deliberately.
update applications set user_id = (select id from auth.users limit 1)
where user_id is null and (select count(*) from auth.users) = 1;

alter table applications alter column user_id set default auth.uid();
create index if not exists applications_user_id_idx on applications (user_id);

drop policy if exists "authenticated applications" on applications;
create policy "applications: own rows" on applications
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 2. per-user opportunity state ────────────────────────────────────────────
create table if not exists opportunity_state (
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  is_read        boolean not null default false,
  is_saved       boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);
alter table opportunity_state enable row level security;
create policy "opportunity_state: own rows" on opportunity_state
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
create index if not exists opportunity_state_user_idx on opportunity_state (user_id, is_saved);

-- Carry the existing (single-user) flags over so nothing looks unread after the swap.
insert into opportunity_state (user_id, opportunity_id, is_read, is_saved)
select (select id from auth.users limit 1), id, is_read, is_saved
from opportunities
where (is_read or is_saved) and (select count(*) from auth.users) = 1
on conflict do nothing;

-- ── 3. shared reference data: read-only for users ────────────────────────────
-- Crawled rows (created_by null) are the shared board and are read-only to users;
-- the fetch cron writes them with the service role. Manually-added rows belong to
-- the user who added them and stay private to that user.
alter table opportunities add column if not exists created_by uuid references auth.users(id) on delete cascade;
alter table opportunities alter column created_by set default auth.uid();
update opportunities set created_by = (select id from auth.users limit 1)
where created_by is null and source = 'manual' and (select count(*) from auth.users) = 1;

drop policy if exists "authenticated opportunities" on opportunities;
create policy "opportunities: read shared and own" on opportunities
  for select using (auth.uid() is not null and (created_by is null or created_by = auth.uid()));
create policy "opportunities: insert own" on opportunities
  for insert with check (created_by = auth.uid());
create policy "opportunities: update own" on opportunities
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "opportunities: delete own" on opportunities
  for delete using (created_by = auth.uid());

drop policy if exists "authenticated programs" on programs;
create policy "programs: read for authenticated" on programs
  for select using (auth.uid() is not null);

drop policy if exists "companies: authenticated write" on companies;
-- "companies: authenticated read" (select) stays as-is.

-- ── 4. storage: users may only read their own attachments ────────────────────
drop policy if exists "attachments_select" on storage.objects;
create policy "attachments_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
