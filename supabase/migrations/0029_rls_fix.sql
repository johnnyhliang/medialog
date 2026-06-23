-- Fix: entry_embeddings had no RLS. opportunities/programs/applications had
-- permissive `using (true)` policies that allowed unauthenticated (anon) access.

-- 1. entry_embeddings: inherit security from the parent entries row.
alter table entry_embeddings enable row level security;

create policy "own embeddings" on entry_embeddings
  for all using (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  )
  with check (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  );

-- 2. opportunities / programs / applications: these tables have no user_id column
-- (they're shared reference/pipeline data). Drop the open `using (true)` policies
-- and replace with an authentication check so anonymous callers are blocked.

drop policy "own opportunities" on opportunities;
create policy "authenticated opportunities" on opportunities
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy "own programs" on programs;
create policy "authenticated programs" on programs
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy "own applications" on applications;
create policy "authenticated applications" on applications
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);
