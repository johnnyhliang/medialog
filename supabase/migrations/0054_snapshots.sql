-- Phase 1 archiver: owned copies of hotlinked files (images/PDFs) so notes
-- survive link rot. The `snapshot` edge function fetches the bytes with the
-- service role and writes here + to the private `snapshots` storage bucket.

create table if not exists snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  entry_id      uuid references entries(id) on delete set null,
  url           text not null,
  kind          text not null default 'file',       -- file | page (page = phase 2)
  storage_path  text,                                -- path within the snapshots bucket
  content_hash  text,                                -- sha256 hex, for dedup
  content_type  text,
  bytes         integer,
  status        text not null default 'done',        -- done | failed
  created_at    timestamptz not null default now(),
  unique (user_id, content_hash)
);
create index if not exists snapshots_user_url_idx on snapshots (user_id, url);

alter table snapshots enable row level security;
create policy "snapshots: own rows" on snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket; the edge function writes with the service role (bypasses RLS),
-- users read only their own folder.
insert into storage.buckets (id, name, public, file_size_limit)
values ('snapshots', 'snapshots', false, 26214400) -- 25 MB
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "snapshots read own" on storage.objects;
create policy "snapshots read own" on storage.objects
  for select using (
    bucket_id = 'snapshots' and (storage.foldername(name))[1] = auth.uid()::text
  );
