-- Topics: flat, no nesting.
create table topics (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Entries: one topic, optional url + auto-fetched title, markdown note.
create table entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic_id         uuid not null references topics(id) on delete cascade,
  url              text,
  title            text,
  note             text not null default '',
  status           text check (status in ('backlog','active','done')),
  created_at       timestamptz not null default now(),
  last_surfaced_at timestamptz
);

-- Tags + join (also used for media-kind like #book, #video).
create table tags (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name    text not null,
  unique (user_id, name)
);

create table entry_tags (
  entry_id uuid not null references entries(id) on delete cascade,
  tag_id   uuid not null references tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);

-- Row Level Security: every row belongs to its creator.
alter table topics enable row level security;
alter table entries enable row level security;
alter table tags enable row level security;
alter table entry_tags enable row level security;

create policy "own topics" on topics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own entries" on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tags" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own entry_tags" on entry_tags
  for all using (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  );

-- Seed the Inbox topic for each new user via trigger.
-- SECURITY DEFINER runs in the auth-admin session, whose search_path does not
-- include `public`; pin search_path and fully-qualify the table so the insert
-- resolves. Otherwise signup fails with "Database error saving new user".
create function seed_inbox() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.topics (user_id, name) values (new.id, 'Inbox');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function seed_inbox();
