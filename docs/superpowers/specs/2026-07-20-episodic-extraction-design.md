# Episodic / Stance Extraction — Design

**Date:** 2026-07-20
**Status:** Scoped, not built
**Depends on:** chunk-retrieval engine (built, dormant), conversation import (built — `scripts/distill-conversations.mjs`)

## The thesis

MediaLog's retrieval — hybrid vector + lexical + trigram, RRF-fused — is **topical**. It
answers *"what's about X."* It cannot answer *"what did I decide about X,"* *"where did I say
this was good enough,"* *"what did I commit to."* Those are **speech-act / stance** queries:
you're searching for a *moment* (an endorsement, a decision, a commitment, an open question),
not a subject.

Dense retrieval is structurally bad at this. Embedding "what did I say was good enough to
pitch" returns passages *about pitching*, not the moment of endorsement. No amount of arm-fusion
fixes it, because all three arms rank by topical/lexical proximity.

**This is the wedge.** Not "personal RAG" (crowded: ChatGPT memory, Rewind/Limitless, Mem0,
Zep). The less-occupied seam: **retrieving speech acts from a person's own accumulated
history, for that person to use** — as opposed to agent-memory infrastructure, which is what
Zep/Graphiti/Letta actually sell. See [[project-yc-quality]] for the positioning.

Honest framing (carry this into any pitch): the *technique* — extract typed events at ingest,
query them as filters — is known (Graphiti does temporal episodic graphs). The differentiated
slice is **application**: personal + conversational + portable/local + human-facing recall.
We are not claiming a new algorithm.

## The mechanism: work at ingest, not at query

Retrieval-time fuzzy matching can't recover a stance. So we do an **extraction pass at ingest**
that emits structured events. Then a stance query becomes a *filter*, not a search.

```
{ type: "endorsement", subject: "compliance platform idea",
  stance: "good enough to pitch", speaker: "user",
  confidence: 0.8, entry_id: ..., chunk_anchor: ..., occurred_at: "2026-05-14" }
{ type: "decision",    subject: "storage", resolution: "remove uploads, hotlink instead", ... }
{ type: "commitment",  subject: "YC application", ... }
{ type: "open_question", subject: "RLS multi-tenant model", ... }
```

## Event taxonomy (v1 — keep small; precision over coverage)

Five types. Resist expanding — a fuzzy taxonomy is the fastest way to a noisy extractor.

| type | captures | example trigger |
|------|----------|-----------------|
| `decision` | a choice was made / settled | "let's go with X", "we'll remove uploads" |
| `endorsement` | something judged good / ready / worth it | "that's good enough to pitch", "this is the wedge" |
| `commitment` | an intention to do something | "I'll apply to YC", "next I'll wire the footer" |
| `open_question` | an unresolved thing flagged | "not sure how RLS should work for shared boards" |
| `insight` | a realization / conclusion reached | "the friction triangle — you only get two" |

Everything else is **not** an event. A passage with no speech act emits nothing — that's
correct, not a miss.

## Schema

New table, parallel to `content_chunks` (does not replace it — topical retrieval stays).

```sql
create table if not exists conversation_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  entry_id    uuid not null references entries(id) on delete cascade,
  chunk_id    uuid references content_chunks(id) on delete set null, -- provenance
  type        text not null check (type in
                ('decision','endorsement','commitment','open_question','insight')),
  subject     text not null,     -- what it's about (short noun phrase)
  statement   text not null,     -- the stance itself, paraphrased tight
  quote       text,              -- verbatim span, for "show me where I said it"
  speaker     text not null default 'user' check (speaker in ('user','assistant')),
  confidence  real not null default 0.5,   -- extractor's own confidence
  occurred_at date,              -- entry date; enables the temporal axis
  source_hash text not null,     -- skip re-extraction when the note is unchanged
  created_at  timestamptz default now()
);
alter table conversation_events enable row level security;
create policy "conversation_events: own rows" on conversation_events
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index conversation_events_user_type on conversation_events (user_id, type);
create index conversation_events_subject_trgm
  on conversation_events using gin (subject gin_trgm_ops);
create index conversation_events_tsv
  on conversation_events using gin (to_tsvector('english', subject || ' ' || statement));
```

Retrieval is then a plain filtered query — optionally *combined* with vector search on
`subject`/`statement` for fuzzy subject matching, but the `type` filter is what makes it work:

```sql
-- "what have I decided I'm ready to pitch"
select * from conversation_events
where user_id = auth.uid()
  and type = 'endorsement'
  and to_tsvector('english', subject||' '||statement) @@ websearch_to_tsquery('pitch ready')
order by occurred_at desc;
```

## Extraction pass

Runs **after** chunking, reusing the exact plumbing in `scripts/rechunk.js` (batched LLM call,
`source_hash` skip, service-role writes). New file `scripts/extract-events.mjs`, or a source
mode added to rechunk.

**Prompt shape** (one call per conversation, whole note as context so the model sees who said
what):

```
Here is a conversation between a user and an AI assistant.
Extract every DECISION, ENDORSEMENT, COMMITMENT, OPEN_QUESTION, or INSIGHT.
For each: {type, subject (<=8 words), statement (<=25 words, paraphrased),
quote (verbatim span), speaker, confidence 0-1}.
Extract ONLY genuine speech acts. If a passage merely discusses a topic without
taking a stance, emit nothing. Prefer precision: omit anything you're unsure of.
Reply JSON only: {"events": [...]}.
```

Model: reuse the `AI_BASE_URL`/`AI_MODEL` passthrough (Gemini's OpenAI-compatible endpoint
works). Cost ≈ one LLM call per conversation (~350 calls for the current corpus), not per chunk.

## The hard part (say this out loud)

The idea is cheap; **extractor precision/recall is the entire product.** Failure modes:
- **Over-extraction** — flags every "maybe we could" as a commitment. Mitigate: precision-biased
  prompt, confidence threshold on display, small taxonomy.
- **Fuzzy type boundaries** — "endorsement" vs "insight" blur. Mitigate: examples in the prompt;
  accept some overlap, filter by multiple types at query time.
- **Cost/latency at scale** — one call per conversation is fine now; a live per-save extraction
  needs the same fire-and-forget treatment as `chunkEntryAsync`.
- **Eval** — needs a small gold set (hand-label events in ~10 conversations) to measure whether
  the extractor is good enough to bet on. Build this *before* trusting it in a demo.

## Why this is the demo

The topical-search demo proves nothing a skeptic respects (it looks like search). This one
shows a query — *"what have I said I was ready to pitch?"* — returning the **exact moment**,
with no keyword overlap between question and answer, dated, quotable. That's unfakeable and it's
the thing the current crop is weakest at. It is the difference between "nice search" and "oh."

## Build order

1. `conversation_events` migration.
2. `scripts/extract-events.mjs` — extraction over the imported "AI Chats" corpus.
3. Hand-label ~10 conversations → precision/recall eval. **Gate: is it good enough?**
4. Minimal filter UI: pick a type, keyword the subject, list dated results with quotes.
5. Only then: fold into the app / pitch surface.
