-- Zip-backup restore brings shared_items rows back, but a restored share
-- should not silently go public again — the owner re-enables it deliberately.
-- Absence-means-private (the original design) can't express "restored but
-- paused", so this adds an explicit flag instead of relying on row presence.
alter table shared_items add column if not exists active boolean not null default true;
