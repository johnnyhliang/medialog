-- Per-entry indexing status, so a failed embed stops being invisible.
--
-- chunkEntryAsync is fire-and-forget by design — indexing must never break a
-- save. But that contract was only half-implemented: it swallowed every error and
-- wrote no status, so a failed embed left the note permanently unsearchable with
-- no signal anywhere. The user's natural conclusion is "I guess I never saved
-- that", which is the worst possible failure mode for a knowledge base.
--
-- Migration 0060 already solved exactly this for article preservation
-- (full_text_status). Indexing is the more important of the two: preservation
-- losing an article costs you its text, a missing index costs you the note
-- entirely.
--
--   null    — never attempted (pre-existing entries, or nothing chunkable)
--   pending — queued or in flight
--   ok      — chunks written
--   empty   — nothing chunkable (no note, takeaway or full_text)
--   failed  — attempted and errored; retryable

alter table entries
  add column if not exists index_status text,
  add column if not exists indexed_at timestamptz,
  add column if not exists index_error text;

-- Partial index: the queue only ever asks for work that isn't done.
-- Ordered by created_at — `entries` has no updated_at column.
create index if not exists entries_index_pending_idx
  on entries (user_id, created_at)
  where index_status in ('pending', 'failed');

-- Coverage in one query, mirroring my_storage_bytes()/preservationCoverage().
create or replace function my_index_status()
returns table (status text, n bigint)
language sql stable security invoker as $$
  select coalesce(e.index_status, 'not_attempted') as status, count(*)::bigint
    from entries e
   where e.user_id = auth.uid()
     and e.deleted_at is null
   group by 1;
$$;

-- Backfill: anything that already has chunks is demonstrably indexed. Everything
-- else stays null ("never attempted") rather than being marked failed — we have
-- no evidence it was ever tried, and claiming failure would be a lie that
-- generates a retry queue out of nothing.
update entries e
   set index_status = 'ok',
       indexed_at = now()
 where e.index_status is null
   and exists (select 1 from content_chunks c where c.entry_id = e.id);
