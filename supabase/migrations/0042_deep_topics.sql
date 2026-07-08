-- Deep topics: read *through* one big resource chapter-by-chapter with
-- takeaway-first notes. Reuses topics (kind flag + source) and entries
-- (takeaway notes), plus a resource_sections outline. See spec 2026-07-08.

-- 1. topics: kind + source (cursor_section_id added after the table exists)
alter table topics
  add column if not exists kind        text not null default 'note',
  add column if not exists source_kind text
    check (source_kind is null or source_kind in ('book', 'web', 'paper', 'pdf')),
  add column if not exists source_url  text;

-- 2. resource_sections: the ordered chapter outline
create table if not exists resource_sections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  topic_id   uuid not null references topics on delete cascade,
  position   int  not null,
  title      text not null,
  status     text not null default 'todo'
             check (status in ('todo', 'reading', 'done')),
  created_at timestamptz default now()
);

alter table resource_sections enable row level security;
create policy "resource_sections: own rows" on resource_sections
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists resource_sections_topic_id on resource_sections (topic_id);

-- 3. topics.cursor_section_id (FK now that resource_sections exists)
alter table topics
  add column if not exists cursor_section_id uuid
    references resource_sections(id) on delete set null;

-- 4. entries: takeaway-first note columns
alter table entries
  add column if not exists section_id uuid references resource_sections(id) on delete set null,
  add column if not exists takeaway   text,
  add column if not exists parent_id  uuid references entries(id) on delete set null;

create index if not exists entries_section_id on entries (section_id);
