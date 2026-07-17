-- Passage-level retrieval. Replaces whole-entry embedding (entry_embeddings is
-- dropped in a later migration, only after backfill is verified).
-- Three retrieval arms fused by RRF: vector (HNSW), lexical (tsvector), fuzzy (pg_trgm).

create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists content_chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  entry_id    uuid not null references entries(id) on delete cascade,
  source      text not null check (source in ('full_text', 'note', 'takeaway')),
  position    int  not null,
  heading     text,
  anchor      text,
  char_start  int,
  content     text not null,          -- shown to the user
  context     text,                   -- machine-written; retrieval only, never displayed
  word_count  int  not null default 0,
  source_hash text not null,
  embedding   vector(1536),
  -- lexical arm indexes context + content together
  tsv         tsvector generated always as (
                to_tsvector('english', coalesce(context, '') || ' ' || coalesce(content, ''))
              ) stored,
  created_at  timestamptz default now(),
  unique (entry_id, source, position)
);

alter table content_chunks enable row level security;
create policy "content_chunks: own rows" on content_chunks
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists content_chunks_entry_source on content_chunks (entry_id, source);
create index if not exists content_chunks_embedding_hnsw
  on content_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists content_chunks_tsv on content_chunks using gin (tsv);
create index if not exists content_chunks_content_trgm
  on content_chunks using gin (content gin_trgm_ops);

-- Hybrid search: three arms, fused by Reciprocal Rank Fusion.
-- RRF fuses on RANK, not raw score, which is why cosine / ts_rank_cd / trigram
-- similarity can combine despite being on incomparable scales.
create or replace function search_chunks(
  query_embedding vector(1536),
  query_text      text,
  match_count     int     default 20,
  rrf_k           int     default 60,
  trgm_threshold  float   default 0.3,
  use_trigram     boolean default false
)
returns table (chunk_id uuid, entry_id uuid, score float)
language sql stable
as $$
  with vector_arm as (
    select c.id, c.entry_id,
           row_number() over (order by c.embedding <=> query_embedding) as rank
    from content_chunks c
    where c.embedding is not null
    order by c.embedding <=> query_embedding
    limit 50
  ),
  lexical_arm as (
    select c.id, c.entry_id,
           row_number() over (
             order by ts_rank_cd(c.tsv, websearch_to_tsquery('english', query_text)) desc
           ) as rank
    from content_chunks c
    where query_text <> ''
      and c.tsv @@ websearch_to_tsquery('english', query_text)
    limit 50
  ),
  fuzzy_arm as (
    select c.id, c.entry_id,
           row_number() over (order by similarity(c.content, query_text) desc) as rank
    from content_chunks c
    where use_trigram
      and query_text <> ''
      and similarity(c.content, query_text) > trgm_threshold
    limit 50
  ),
  fused as (
    select id, entry_id, sum(w) as score from (
      select id, entry_id, 1.0 / (rrf_k + rank) as w from vector_arm
      union all
      select id, entry_id, 1.0 / (rrf_k + rank) as w from lexical_arm
      union all
      select id, entry_id, 1.0 / (rrf_k + rank) as w from fuzzy_arm
    ) arms
    group by id, entry_id
  )
  select id, entry_id, score
  from fused
  order by score desc
  limit match_count;
$$;
