-- Article text preservation: coverage markers.
--
-- Numbered 0060 rather than 0057 on purpose: 0057-0059 are reserved for work in
-- flight on parallel branches, and migration numbers must never be reused once
-- applied. Gaps are harmless; collisions are not.
--
-- `full_text` alone cannot answer "is this entry preserved?" — a null means both
-- "never attempted" and "attempted, nothing extractable". These columns split
-- those cases so coverage is a single query.

alter table entries add column if not exists full_text_status text;
-- ok      : article body preserved
-- empty   : fetched and parsed, but no usable article body (JS-only page, paywall)
-- failed  : fetch/parse errored (network, timeout, non-HTML)
-- null    : never attempted (pre-backfill entries, or non-URL entries)

alter table entries add column if not exists full_text_extractor text;
-- readability | heuristic — which rung of the fallback chain produced the text.

alter table entries add column if not exists full_text_at timestamptz;
-- When preservation last ran, so a re-preserve pass can target stale entries.

-- Coverage reporting + the backfill's "what's left" scan both filter on status,
-- and the backfill re-runs frequently enough that a partial index earns its keep.
create index if not exists entries_full_text_status_idx
  on entries (user_id, full_text_status)
  where deleted_at is null;

-- Coverage query (documented in docs/content-preservation-plan.md):
--
--   select
--     count(*)                                          as url_entries,
--     count(*) filter (where full_text_status = 'ok')    as preserved,
--     count(*) filter (where full_text_status = 'empty') as unextractable,
--     count(*) filter (where full_text_status = 'failed')as failed,
--     count(*) filter (where full_text_status is null)   as not_attempted,
--     round(100.0 * count(*) filter (where full_text_status = 'ok')
--           / greatest(count(*), 1), 1)                  as pct_preserved
--   from entries
--   where user_id = auth.uid() and deleted_at is null and url is not null;
