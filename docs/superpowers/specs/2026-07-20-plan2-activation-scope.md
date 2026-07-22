# Plan 2 — Activate the Chunk-Retrieval Engine (Scope)

**Date:** 2026-07-20
**Status:** Scoped, not executed. Engine is BUILT + DEPLOYED but DORMANT.
**Verified state (2026-07-20):** the live app still runs the OLD whole-entry path.

## Current reality (evidence)

| Concern | Old (live) | New (built, dormant) |
|---|---|---|
| Index on save | `embedEntryAsync` → `entry_embeddings` (App.jsx, 8 call sites) | `chunkEntryAsync` → `content_chunks` (`src/lib/chunkEntry.js`, imported nowhere) |
| Semantic search | `searchSemantic` → `match_entries` RPC (ExploreView) | `searchChunks` → `search_chunks` RPC (`src/lib/db/retrieval.js`, used only by eval) |
| Related entries | — | `relatedTo()` exists in `retrieval.js`, unused |
| Query embedding | edge fn `embed-entry` (now supports `texts[]` + `taskType` ✓) | same fn, via `retrieval.js` |

So the engine is a step from live. Backfill (running 2026-07-20) populates `content_chunks` for
the corpus; these wiring changes flip the app onto it.

## Steps (each independently shippable, ordered by risk)

### 1. Swap the indexer — App.jsx `embedEntryAsync` → `chunkEntryAsync`
- Replace import (App.jsx:17) and all 8 call sites (407, 450, 573, 658, 666, 676, 715, 748).
- `chunkEntryAsync(supabase, entry)` is signature-compatible (fire-and-forget, resolves user
  itself). Verify it's called with an entry carrying `note`/`full_text`/`takeaway`.
- **Test:** save an entry → `content_chunks` rows appear with embeddings.

### 2. Repoint search — ExploreView `searchSemantic` → `searchChunks`
- ExploreView.jsx:2 import, :99 call. `searchChunks` returns passage-level hits
  (`{chunkId, entryId, score, content, heading, anchor}`), NOT whole entries — the result
  renderer must change to show a **passage** + its parent entry, not an entry card.
- This is the "passage-mode search" item: results are quotes, not documents. Bigger UI change
  than a one-line swap — scope a `PassageResult` component.
- **Test:** semantic query returns passages; clicking opens the parent entry at the anchor.

### 3. Related-entries footer
- New component using `relatedTo(supabase, { entryId })` (already built, MMR-diversified).
- Render at the bottom of the entry/reading view: "Related" → up to 5 cross-topic passages.
- **Test:** open a conversation entry → footer shows related passages from *other* entries.

### 4. Retire `entry_embeddings` (LAST — only after 1–3 verified)
- Remove `embedEntryAsync` / `embedEntry.js` / `searchSemantic` / `match_entries`.
- Drop `entry_embeddings` table + `match_entries` fn in a migration (the chunk spec always
  planned this "after backfill is verified").
- **Gate:** do not drop until chunk search is live and the backfill covers the corpus.

## Edge-function note
`embed-entry` already handles `{texts[], taskType}` → `{embeddings[]}` (verified 2026-07-20),
so `retrieval.js` and `chunkEntry.js` batch/query paths work against the deployed function with
a user JWT. No edge-function change needed. (An earlier read of a stale version suggested
otherwise — corrected.)

## Out of scope here (already scoped elsewhere)
- **RLS / multi-tenant audit** and **upload removal** — fully detailed in `PRODUCTION.md`
  (blockers §, lines 29–72). Status: NOT started. The actual gate for uploads is revoking
  insert on the `attachments` storage bucket via RLS, not UI removal. Left as-is; no new scope
  needed, just execution.
