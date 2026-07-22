-- Full-fidelity GitHub sync needs a little more config than the original
-- markdown-only backup: which branch to write to, and a record of the last
-- snapshot so the UI can show what was backed up without calling GitHub.

alter table user_configs add column if not exists repo_branch text not null default 'main';
alter table user_configs add column if not exists last_backup_sha text;
alter table user_configs add column if not exists last_backup_summary jsonb;
