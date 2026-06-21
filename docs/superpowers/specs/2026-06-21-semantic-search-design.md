# Semantic Search Design

**Date:** 2026-06-21
**Phase:** C
**Status:** Spec / not yet planned

## Goal

Search entries by meaning, not just keywords. "what did I read about attention mechanisms" finds entries about transformer architecture even if those words never appear. Solves the scale problem: at 500+ entries, keyword search fails because you don't remember what you wrote.

## How it works

Every entry's note + title is converted to a vector embedding (a list of ~1500 numbers representing meaning). Embeddings are stored in Supabase using the `pgvector` extension. When you search, your query is also embedded and the database returns entries whose vectors are closest (cosine similarity).

## Architecture

### Embedding generation
- **Model:** OpenAI `text-embedding-3-small` (1536 dimensions, cheap — ~$0.02 per 1M tokens, so essentially free for personal use) or Supabase's built-in `gte-small` model (free, runs in the database, lower quality)
- **When:** Embed on entry create/update via a Supabase edge function `embed-entry`. Called after save, async — doesn't block the UI.
- **Stored in:** new `entry_embeddings` table with `entry_id` (FK) + `embedding vector(1536)`

### Search
- New `searchSemantic(supabase, query)` function in `src/lib/db/entries.js`
- Embeds the query via edge function, then calls Supabase RPC `match_entries(query_embedding, threshold, count)`
- Returns entries ordered by similarity score
- ExploreView gets a toggle: "keyword" vs "semantic" search mode

### Backfill
- One-time backfill job: embed all existing entries on first setup. Run as a script, not in the UI.

## New DB objects

```sql
-- Enable pgvector (free on Supabase)
create extension if not exists vector;

create table entry_embeddings (
  entry_id uuid primary key references entries(id) on delete cascade,
  embedding vector(1536),
  embedded_at timestamptz not null default now()
);

create index on entry_embeddings using ivfflat (embedding vector_cosine_ops);

-- RPC function
create or replace function match_entries(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
) returns table (id uuid, similarity float) ...
```

## Edge function: `embed-entry`

Accepts `{ text: string }`, calls OpenAI embeddings API, returns `{ embedding: number[] }`. JWT-gated (same pattern as `ai` and `enrich`). Called by client after entry save.

## Constraints

- Semantic search is a Phase C feature — don't build until you have enough content (100+ meaningful entries) for it to be useful
- Requires OpenAI API key (or switch to Supabase's free built-in model — lower quality but zero cost)
- Keyword search stays as the default — semantic is an opt-in mode in ExploreView
- Embedding updates on every note edit could get expensive — debounce to only re-embed if note changed by >50 chars or after 5 minutes of no edits
- `pgvector` is available on Supabase free tier
