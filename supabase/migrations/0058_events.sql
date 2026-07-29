-- Product event capture. Numbered 0058 because 0057 and 0060 are claimed by
-- parallel worktrees (AI usage metering and its follow-ups); skipping avoids a
-- filename collision on merge.
--
-- Client-written, therefore untrusted: this table answers "what did users do",
-- never "what should we bill". Billing lives in ai_usage, which clients cannot
-- write. Keep that separation.
--
-- props is counts-and-enums only — never note text, titles, URLs or search
-- queries. src/lib/track.js sanitizes against a fixed schema before insert.

create table if not exists events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name       text not null,
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists events_user_created_idx on events (user_id, created_at desc);
create index if not exists events_name_created_idx on events (name, created_at desc);

alter table events enable row level security;

-- Split policies rather than `for all`: events are append-only from the client,
-- so there is deliberately no update or delete policy.
create policy "events: insert own" on events
  for insert with check (user_id = auth.uid());
create policy "events: read own" on events
  for select using (user_id = auth.uid());

-- Activation queries live in supabase/queries/activation.sql.
