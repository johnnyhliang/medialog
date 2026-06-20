-- supabase/migrations/0013_opportunities.sql

-- Opportunities: fetched from all sources, deduped by (source, url)
create table opportunities (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  company     text,
  title       text not null,
  body        text,
  url         text not null,
  author      text,
  posted_at   timestamptz,
  fetched_at  timestamptz not null default now(),
  tags        text[],
  is_read     boolean not null default false,
  is_saved    boolean not null default false,
  unique (source, url)
);
alter table opportunities enable row level security;
create policy "own opportunities" on opportunities for all using (true);
create index on opportunities (posted_at desc);
create index on opportunities (is_read, posted_at desc);

-- Programs: fellowship/internship-track programs with deadline tracking
create table programs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  url           text not null,
  category      text,
  company       text,
  deadline      date,
  window_open   boolean not null default false,
  notes         text,
  last_checked  timestamptz
);
alter table programs enable row level security;
create policy "own programs" on programs for all using (true);

-- Applications: user's job application pipeline
create table applications (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid references opportunities(id) on delete set null,
  company         text not null,
  role            text not null,
  url             text,
  status          text not null default 'saved'
                  check (status in ('saved','applied','screen','interview','offer','rejected','ghosted')),
  applied_at      date,
  deadline        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table applications enable row level security;
create policy "own applications" on applications for all using (true);
create index on applications (status, created_at desc);
