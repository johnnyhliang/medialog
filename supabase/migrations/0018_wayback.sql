-- supabase/migrations/0018_wayback.sql
alter table entries add column if not exists wayback_submitted_at timestamptz;
