-- The third pass at the same hole, and the reason it keeps reopening is worth
-- writing down.
--
-- 0044's multitenant RLS audit replaced the old "authenticated programs"
-- ALL-policy with a SELECT-only one. 0077 noticed and restored UPDATE and
-- INSERT — and its comment describes this exact failure mode at length — but it
-- did not add DELETE back. So Settings > Programs' remove button has been
-- silently no-oping ever since, for the same reason the toggle and the add form
-- were: a Postgres DELETE blocked by RLS with no matching policy affects 0 rows
-- and returns NO ERROR.
--
-- That is what makes this class of bug so durable here. `programs` has no
-- user_id column, so nothing user-scoped trips over it; the client sees
-- `{ error: null }` and removes the row locally; the row reappears on the next
-- reload with nothing in between to explain it. Three separate verbs, three
-- separate discoveries, one missing policy each time.
--
-- Replacing SELECT/INSERT/UPDATE/DELETE with a single ALL-policy would have
-- prevented all three. It is deliberately NOT done here: 0044 split them on
-- purpose so that a future per-user programs model can tighten one verb without
-- reasoning about the other three. The cost of that choice is exactly this bug,
-- so the mitigation is the assertion at the bottom rather than a coarser policy.
--
-- programs is shared, single-user reference data (like `opportunities`), so this
-- mirrors that table's shape: any authenticated user may write. Revisit
-- alongside the rest of 0044's model if this app ever needs one program list per
-- user rather than one shared list — not needed today.

drop policy if exists "programs: delete for authenticated" on programs;
create policy "programs: delete for authenticated" on programs
  for delete using (auth.uid() is not null);

-- Fail the migration if any of the four verbs is unpolicied, so the next person
-- to tighten this table finds out here rather than from a button that quietly
-- does nothing. This is the check that would have caught 0077's omission.
do $$
declare
  missing text;
begin
  select string_agg(v, ', ')
    into missing
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as v
   where not exists (
     select 1
       from pg_policies
      where schemaname = 'public'
        and tablename = 'programs'
        and cmd in (v, 'ALL')
   );

  if missing is not null then
    raise exception
      'programs is missing an RLS policy for: %. Every verb needs one - a blocked write returns 0 rows and no error, so the UI reports success and reverts on reload.',
      missing;
  end if;
end $$;
