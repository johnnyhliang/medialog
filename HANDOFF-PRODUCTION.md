# MediaLog → production handoff

Paste the prompt below into a fresh Claude Code session **in `C:\Users\liang\Documents\medialog`**.
Scope is deliberately narrow: **ship what exists. No new features.**

---

## THE PROMPT

> I'm getting MediaLog ready for real users. **Do not add features.** Only activate what's
> already built and close the production blockers. Work in small verified steps and commit each one.
>
> Read these first: `docs/superpowers/specs/2026-07-20-plan2-activation-scope.md` and `PRODUCTION.md`.
>
> **Context you need:**
> - The chunk-retrieval engine (`search_chunks` RPC, `src/lib/db/retrieval.js`, `src/lib/chunkEntry.js`)
>   is BUILT and DEPLOYED but DORMANT — the live app still uses the old whole-entry path.
> - The app currently calls `embedEntryAsync` (old) in App.jsx in 8 places, and ExploreView still
>   calls `searchSemantic` → the old `match_entries` RPC.
> - The deployed `embed-entry` edge function DOES support `{texts[], taskType}` → `{embeddings[]}`,
>   so no edge-function change is needed.
> - 364 conversation entries were imported into the "AI Chats" topic. ~192 have embeddings; the
>   rest stalled on the Gemini free-tier daily quota. `scripts/rechunk.js` is resumable and now
>   paginates + backs off on 429/network errors.
>
> **Phase 2 — activate the engine (in this order, verify each before moving on):**
> 1. Swap the indexer: replace `embedEntryAsync` with `chunkEntryAsync` in App.jsx (import at :17,
>    call sites at 407, 450, 573, 658, 666, 676, 715, 748). Verify: saving an entry writes rows to
>    `content_chunks` with embeddings.
> 2. Repoint search: ExploreView `searchSemantic` → `searchChunks`. NOTE this returns *passages*
>    (`{chunkId, entryId, content, heading, anchor}`), not entries — the result renderer must show a
>    passage + its parent entry. This is a real UI change, not a one-line swap.
> 3. Related-entries footer using the existing `relatedTo()` in `retrieval.js` (already MMR-diversified).
> 4. ONLY after 1–3 are verified: retire `entry_embeddings` — remove `embedEntryAsync`,
>    `embedEntry.js`, `searchSemantic`, `match_entries`, and drop the table + function in a migration.
>
> **Production blockers (from PRODUCTION.md — these gate real users):**
> - **RLS / multi-tenant audit.** The app grew up effectively single-user. Audit every table's RLS
>   before anyone else signs in. Shared/global tables need read-for-all + NOT user-writable.
> - **Remove file uploads.** The real gate is revoking insert on the `attachments` storage bucket via
>   Supabase storage RLS — UI removal alone does NOT prevent uploads (anyone can call
>   `supabase.storage.from('attachments').upload(...)` directly). Also decide the fate of existing objects.
>
> **Rules:** run `npm test` before each commit. Don't rewrite pushed history. No Co-Authored-By
> trailers. If something looks like scope creep, stop and ask.

---

## Repo state at handoff (2026-07-21)

- Branch **`feat/conversation-distiller`** — 3 commits: the conversation distiller, `--import`
  wiring, and the pitch page + rechunk pagination fix + the two scoping specs.
- Branch **`chore/worktree-cleanup`** — 5 commits: untracked `.omx/` + `supabase/.temp/`,
  reel-title fix, goals-tracker lib (17 tests passing), the RAG spec, and gitignoring the
  session exports.
- **Nothing has been pushed.** Both branches are local; consolidate before pushing.
- `.env.local` holds a `GEMINI_API_KEY` (free tier, daily-quota-limited). Not committed.

## Known gotchas

- PostgREST caps selects at 1000 rows — `rechunk.js` now paginates, but any new bulk query must too.
- `entries.note` has a 100k-char CHECK constraint; the distiller splits oversized conversations.
- Conversation entries carry the **import** date, not the real conversation date (the real dates
  live in the claude.ai export). Anything temporal in-app needs that backfilled.
