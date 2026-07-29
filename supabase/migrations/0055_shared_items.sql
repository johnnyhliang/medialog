-- Public sharing registry. A row here = that item is public; deleting it makes
-- it private again (no is_public column — absence is private). The public page
-- is served by the `public-share` edge function using the service role, so RLS
-- on entries/topics stays owner-only and the anon key never reads them directly.

create table if not exists shared_items (
  slug        text primary key,           -- unguessable public token (16-char base62)
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('entry', 'topic')),
  ref_id      uuid not null,              -- entry_id or topic_id
  title       text,                       -- snapshot label for the manager list
  created_at  timestamptz not null default now(),
  unique (user_id, kind, ref_id)          -- one share per item
);
create index if not exists shared_items_ref_idx on shared_items (kind, ref_id);

alter table shared_items enable row level security;

-- Owners manage only their own registry rows. Anonymous visitors NEVER read this
-- table directly — the public-share function (service role) is the only door.
create policy "shared_items: own rows" on shared_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
