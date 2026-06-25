create table if not exists capture_log (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null,
  url        text        not null,
  ok         boolean     not null,
  message    text,
  entry_id   uuid        references entries(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table capture_log enable row level security;

create policy "users see own capture log"
  on capture_log for select
  using (auth.uid() = user_id);

create index capture_log_user_created on capture_log (user_id, created_at desc);
