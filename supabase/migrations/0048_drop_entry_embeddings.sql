-- Retire the legacy whole-entry embedding path. content_chunks (0043) has
-- superseded it and the whole library is now backfilled (391/391 entries,
-- verified 2026-07-23), so the fallback in searchSemantic is gone and these
-- can be dropped safely.

drop function if exists match_entries(vector, float, int);
drop table if exists entry_embeddings;
