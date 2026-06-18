create table entry_versions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id   uuid not null references entries(id) on delete cascade,
  note       text not null default '',
  created_at timestamptz not null default now()
);
alter table entry_versions enable row level security;
create policy "own versions" on entry_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index entry_versions_entry_idx on entry_versions (entry_id, created_at desc);
