-- Feeds: RSS sources the user subscribes to
create table if not exists feeds (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  url          text not null,
  name         text not null,
  category     text,
  last_fetched_at timestamptz,
  created_at   timestamptz default now()
);

alter table feeds enable row level security;
create policy "feeds: own rows" on feeds
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Feed items: ephemeral articles fetched from feeds
create table if not exists feed_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  feed_id      uuid not null references feeds on delete cascade,
  title        text not null,
  url          text not null,
  summary      text,
  published_at timestamptz,
  fetched_at   timestamptz default now(),
  expires_at   timestamptz not null,
  saved_at     timestamptz,
  dismissed_at timestamptz,
  unique (user_id, url)
);

alter table feed_items enable row level security;
create policy "feed_items: own rows" on feed_items
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists feed_items_feed_id on feed_items (feed_id);
create index if not exists feed_items_expires_at on feed_items (expires_at);
