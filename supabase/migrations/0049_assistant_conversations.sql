-- Persistent "Ask your library" chat. The assistant panel was in-memory only —
-- conversations vanished on reload. Store them so threads survive and sync
-- across devices (start on desktop, resume on phone). Owner-scoped RLS.

create table if not exists assistant_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title      text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assistant_conversations_user_idx
  on assistant_conversations (user_id, updated_at desc);

create table if not exists assistant_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references assistant_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role            text not null check (role in ('user', 'assistant')),
  content         text not null default '',
  -- citation list the UI renders, as returned by askLibrarian: [{n,entryId,title,heading,anchor}]
  sources         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists assistant_messages_conversation_idx
  on assistant_messages (conversation_id, created_at);

alter table assistant_conversations enable row level security;
alter table assistant_messages enable row level security;

create policy "assistant_conversations: own rows" on assistant_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "assistant_messages: own rows" on assistant_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
