-- Interview readiness tracker: reuses topics as "patterns" and entries as
-- "problems". A pattern-topic has pattern_target (problems to feel ready) and
-- tracks[] (which interview tracks it serves). Problems add difficulty +
-- self-rated confidence on top of the existing status + SM2 SRS fields.

alter table topics
  add column if not exists pattern_target int,
  add column if not exists tracks text[] not null default '{}';

alter table entries
  add column if not exists difficulty text
    check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  add column if not exists confidence smallint
    check (confidence is null or (confidence between 1 and 5));

-- Fast lookup of pattern-topics by track.
create index if not exists topics_tracks_gin on topics using gin (tracks);
