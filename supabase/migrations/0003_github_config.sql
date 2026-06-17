-- User configurations for GitHub backup and other settings.
create table user_configs (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  github_token      text, -- Encrypted AES-GCM
  github_user       text,
  repo_name         text not null default 'medialog-backup',
  is_private        boolean not null default true,
  auto_backup       boolean not null default true,
  last_backup_at    timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- RLS: Users can only see and edit their own config.
alter table user_configs enable row level security;

create policy "own config" on user_configs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger to update updated_at.
create function update_updated_at_column() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_user_config_updated
  before update on user_configs
  for each row execute function update_updated_at_column();
