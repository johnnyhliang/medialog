-- Runtime kill switch for founder-gated UI surfaces that are now public-facing.
--
-- Flip it off without a frontend rebuild:
--   update app_flags set enabled = false where key = 'founder_features_public';
--
-- Flip it back on:
--   update app_flags set enabled = true where key = 'founder_features_public';

create table if not exists app_flags (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);

alter table app_flags enable row level security;

drop policy if exists "app_flags: public read" on app_flags;
create policy "app_flags: public read" on app_flags
  for select
  using (true);

insert into app_flags (key, enabled)
values ('founder_features_public', true)
on conflict (key) do nothing;
