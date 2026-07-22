# MediaLog AI Agent + RAG Layer — Design Spec

**Date:** 2026-06-25
**Status:** Draft (for review)
**Roadmap:** Phase C — synthesis moat (`2026-06-21-strategic-roadmap.md`). Builds on the
"AI agent with persistent memory = the living docs" idea in `docs/PROJECT.md` §6.

---

## Goal

Give MediaLog an assistant that can **answer questions across the whole library, suggest
organization, and safely act on data** — without ever holding "everything" in its context and
without being able to do anything irreversible. It closes the RETAIN→SYNTHESIZE end of the loop:
"ask my library," "sort my inbox," "what have I not revisited," "draft this topic's doc."

Non-negotiable: the agent is **non-destructive by construction** (principle #8). It proposes
destructive actions; it performs only reversible ones. Every mutation is versioned + git-backed.

---

## Core insight — retrieval, not a big context window

The model never receives the full library. Each turn we assemble a small, relevant prompt from
three memory tiers, cheapest → richest:

| Tier | Source | Represents | Rough size |
|------|--------|-----------|-----------|
| 1. Structured memory | `topics.master_doc` (living docs) | a whole domain, curated | ~1–3 KB each |
| 2. Retrieved entries (RAG) | `entries` + pgvector similarity | the K most relevant entries | top-8, ~2–4 KB |
| 3. Conversation memory | rolling per-user summary (not raw transcripts) | prior sessions, lossy | ~1 KB |

**Assembled prompt** = system instructions + relevant master doc(s) [T1] + top-K retrieved
entries [T2] + rolling user summary [T3] + the question + tool definitions. Small and fast even
over 10,000 entries. This is how Claude-style "memory" works: retrieval + summarization, not a
giant window.

---

## Architecture

```
  React chat UI  ──►  `ai-agent` edge function  ──►  provider-agnostic `ai` (existing)
                              │  tool-calling loop
                              ▼
        ┌───────────────── tool layer (wraps src/lib/db/*) ─────────────────┐
        │  READ (direct)     SAFE MUTATE (direct)     DESTRUCTIVE (propose)  │
        └────────────────────────────────────────────────────────────────────┘
                              │
              Supabase: entries(+embedding vector), topics.master_doc,
                        entry_versions, agent_actions, conversations
                              │
                     github-backup  (external, timestamped audit + undo)
```

### Retrieval (Tier 2 — the foundation)
- Add `embedding vector(N)` to `entries` (pgvector; N per chosen model — a small/cheap embedding
  model is fine, e.g. 256–768 dims). Migration `00NN_entry_embeddings.sql` + an ivfflat/hnsw index.
- **Embed on write:** on create/update, an edge function embeds `title + note` and stores it.
  Home: extend the existing `embedEntry.js` / `embedEntryAsync.js` scaffolding.
- **Retrieve:** `search_entries(query)` embeds the query and runs
  `ORDER BY embedding <=> $q LIMIT 8` (cosine). This is also the **"Related (AI)"** mode the
  search scope-selector was already designed to gain.
- Backfill job to embed existing entries once.

### Conversation memory (Tier 3)
- `conversations` table for audit (messages), but the *working* memory is a rolling summary
  written after each session into a `user_memory` doc (or appended to the relevant topic doc).
  Never replay raw transcripts into context.

---

## Tool layer (the agent's only way to touch data)

Wrap existing `src/lib/db/*` functions — the agent never writes SQL. Three tiers by blast radius:

```
READ / SUGGEST  (run directly, zero risk)
  search_entries(query)          → RAG retrieval
  get_topic_doc(topic)           → Tier-1 memory
  list_inbox(), list_stale()     → triage / anti-rot candidates
  suggest_topic(entry), suggest_tags(entry), draft_topic_doc(topic)

SAFE MUTATE  (reversible → run directly, logged)
  assign_topic, set_status, add_tag, remove_tag, pin, set_surfaced

DESTRUCTIVE / BULK  (propose → human confirm ONLY)
  soft_delete, bulk_reassign, merge_topics, empty_trash
```

MCP vs in-app: start with **in-app tool-calling** through the `ai` edge function (simplest, we
already have it). Add an **MCP server wrapper** later so external clients (Claude Desktop) can
reach the same tools — that's the "use my library from anywhere" story, not needed for v1.

---

## Safety model (the differentiator)

1. **No hard delete, ever, from the agent.** The tool layer simply does not expose permanent
   deletion. Worst case is `soft_delete` (sets `deleted_at`) → recoverable in Trash. Enforce at
   the tool boundary **and** with Supabase RLS/policies so it's real, not prompt-level.
2. **Two-tier gating.** Reversible tools run directly; destructive/bulk tools return a *proposal*
   object the UI renders as a confirm card ("Reassign 4 entries → Systems? [Apply] [Discard]").
   The agent proposes; the human approves. Never the reverse.
3. **Versioned + git-backed actions.** Agent mutations flow through the same handlers that
   snapshot to `entry_versions` and push markdown to `github-backup` → every action inherits
   full undo + an external timestamped audit log. Tag agent commits
   (`chore(agent): …`) so the agent's work can be diffed/reverted in isolation.
4. **Action log.** `agent_actions` (tool, args, result, created_at, reverted_at) powers a
   one-click "undo last agent session."

---

## Build order

1. **pgvector + embed-on-write + backfill** — retrieval foundation; nothing works without it.
2. **Read-only agent**: `search_entries` + `get_topic_doc` → "ask my library" RAG chat. Zero
   mutation risk, immediately useful, validates retrieval quality.
3. **Safe mutations** (status / tags / assign) through the tool layer + `agent_actions` log.
4. **Proposal-gated destructive actions** + git-tagged audit trail + undo-session.
5. **MCP wrapper** (optional, later) for external clients.

Steps 1–2 also deliver the roadmap's semantic/"Related (AI)" search for free.

---

## Open questions

- **Embedding model + dims** — cheap/local vs hosted; dimension vs index cost tradeoff.
- **Re-embed triggers** — only on note change? debounce? cost per edit.
- **Master-doc auto-drafting** — agent proposes doc updates as diffs the user accepts (keeps
  human-in-the-loop for the synthesis layer), rather than silently rewriting.
- **Context budget** — how many topic docs to include when a question spans domains.
- **Multi-user** — current design assumes single-user (RLS per user); revisit if opened up.
