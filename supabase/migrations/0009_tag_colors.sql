-- Add optional color to tags
alter table tags add column if not exists color text;
