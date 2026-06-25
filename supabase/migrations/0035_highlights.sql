create table if not exists highlights (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  entry_id    uuid        not null references entries(id) on delete cascade,
  text        text        not null,
  note        text,
  color       text        not null default 'yellow',
  created_at  timestamptz not null default now()
);

alter table highlights enable row level security;

create policy "users manage own highlights"
  on highlights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index highlights_entry on highlights (entry_id);
