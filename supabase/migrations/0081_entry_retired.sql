-- A resurfacing queue with no terminal state is a queue nobody finishes.
--
-- Today the only ways out of Revisit are: grade it (Hard/Good/Easy all
-- *reschedule* — they differ in when it comes back, never whether), snooze it
-- (comes back sooner), or delete it. So an entry you have decided you are done
-- with keeps returning forever unless you destroy it, and destroying something
-- you might want to search for later is the wrong trade. The queue can only
-- grow, which is how review habits die.
--
-- `retired_at` is the missing third option: keep the entry, keep it searchable,
-- stop scheduling it. "I've decided about this" rather than "I want this gone".
alter table entries add column if not exists retired_at timestamptz;

-- Partial index: every read that cares about this asks for the *un*-retired
-- rows, and those are the majority, so index the exception.
create index if not exists entries_retired_at_idx
  on entries (retired_at)
  where retired_at is not null;

comment on column entries.retired_at is
  'When the user decided this entry needs no further review. Excluded from the '
  'revisit queue and from the un-triaged/stale nags, but still searchable and '
  'still restorable — distinct from deleted_at, which means gone.';
