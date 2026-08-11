-- Fix: 0044's multitenant RLS audit replaced the old "authenticated programs"
-- ALL-policy with a SELECT-only one, and never added an UPDATE policy back.
-- `programs` is a shared reference table with no user_id column, so this
-- wasn't caught by anything user-scoped — Settings > Programs' toggle-window
-- and edit-deadline controls have been silently no-oping ever since: a Postgres
-- UPDATE blocked by RLS with no matching policy affects 0 rows and returns no
-- error, so the UI shows the change until the next reload quietly reverts it.
--
-- Same story for the "+ add program" form's INSERT.
--
-- programs is shared, single-user reference data (like `opportunities`), so
-- this mirrors that table's shape: any authenticated user may write. Revisit
-- alongside the rest of 0044's model if this app ever needs one program list
-- per user rather than one shared list — not needed today.

drop policy if exists "programs: update for authenticated" on programs;
create policy "programs: update for authenticated" on programs
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "programs: insert for authenticated" on programs;
create policy "programs: insert for authenticated" on programs
  for insert with check (auth.uid() is not null);
