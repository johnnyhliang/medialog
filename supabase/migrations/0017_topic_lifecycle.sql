-- supabase/migrations/0017_topic_lifecycle.sql

alter table topics add column if not exists archived_at timestamptz default null;
alter table topics add column if not exists deleted_at  timestamptz default null;
