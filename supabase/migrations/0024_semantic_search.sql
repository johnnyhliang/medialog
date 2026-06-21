create extension if not exists vector;

create table if not exists entry_embeddings (
  entry_id uuid primary key references entries(id) on delete cascade,
  embedding vector(1536),
  embedded_at timestamptz not null default now()
);

create index if not exists entry_embeddings_embedding_idx
  on entry_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_entries(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 20
)
returns table (entry_id uuid, similarity float)
language sql stable
as $$
  select
    ee.entry_id,
    1 - (ee.embedding <=> query_embedding) as similarity
  from entry_embeddings ee
  where 1 - (ee.embedding <=> query_embedding) > match_threshold
  order by ee.embedding <=> query_embedding
  limit match_count;
$$;
