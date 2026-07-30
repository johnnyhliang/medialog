-- Gains Feed: Quant's Strand A/B/C menu items, currently markdown-only in
-- gains-system.md. Dev's Concept Bank reuses resource_sections (deep topics)
-- and Interview reuses its existing pattern/problem tables — neither needs a
-- new table. See docs/gains-feed-design.md.

create table if not exists menu_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  track          text not null check (track in ('quant-build', 'quant-read', 'quant-mental')),
  title          text not null,
  status         text not null default 'open' check (status in ('open', 'done', 'dropped')),
  position       int,
  last_pulled_at timestamptz,
  created_at     timestamptz default now()
);

alter table menu_items enable row level security;
create policy "menu_items: own rows" on menu_items
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists menu_items_user_track on menu_items (user_id, track);
