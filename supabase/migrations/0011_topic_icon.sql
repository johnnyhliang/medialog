-- Add optional Lucide icon name to topics
alter table topics add column if not exists icon text;
