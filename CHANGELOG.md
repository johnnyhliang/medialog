# Changelog

Feature history for MediaLog, reconstructed from git history (322 `feat`/`fix` commits as of
2026-07-18). Newest first. This file was created retroactively on 2026-07-18 — entries before that
date are grouped by capability rather than by release, since the project has no release tags.

Conventions going forward: add a bullet under **Unreleased** when a feature lands, and cut a dated
section when you deploy. Detailed design rationale lives in `docs/superpowers/specs/`.

---

## Unreleased

### Chunk retrieval consumers (Plan 2 of 2) — planned, not built
Implementation plan written: `docs/superpowers/plans/2026-07-20-chunk-retrieval-consumers.md`
(5 TDD tasks, ready to execute). Wires the engine into the app:
- Repoint `searchSemantic` → `searchChunks` via an entry roll-up adapter, **with a fallback to the
  legacy `match_entries` path while `content_chunks` is empty**, so search never regresses mid-migration.
- Explore renders the **matching passage** per hit. Note: `search_chunks` returns an RRF score
  (~0.01–0.05), which is a rank artifact — rendering it as a similarity percentage would be
  meaningless, so the passage replaces the percentage.
- `embedEntryAsync` → `chunkEntryAsync` at all 8 `App.jsx` call sites.
- **On-demand** related-entries footer (never per-card on render — that would fire N RPCs per list).
- Final task retires `entry_embeddings`/`match_entries` (migration `0044`), gated on the backfill.

Open design calls deferred to build time (refinements, not architecture): how many related items to
show, where the footer sits, and highlight-on-scroll behaviour. Precise scroll-into-reader for
`char_start` passages is deferred entirely.

### Chunk retrieval engine (Plan 1 of 2) — merged to master
Passage-level retrieval replacing whole-entry embedding. **Built and deployed, but dormant** — no UI
calls it yet; `searchSemantic` still uses the old `match_entries` path. Wiring is Plan 2.
- `content_chunks` table (migration `0043`) with three retrieval indexes: HNSW vector, GIN tsvector,
  GIN trigram — plus a `search_chunks` RPC fusing all three arms by Reciprocal Rank Fusion.
- Structure-first hybrid chunking (`chunkContent`): markdown splits on headings with enforced
  150–350 word bounds; plain text windows with overlap. Anchors match `MarkdownView`'s DOM ids.
- **Contextual Retrieval** — 50–100 tokens of model-written context prepended to each chunk before
  embedding and lexical indexing. Batched one call per document. Published measurements: −35%
  retrieval failures alone, −49% with the lexical arm.
- `embed-entry` gained batch (`{texts}`) and `taskType` support, backward compatible with `{text}`.
- Tool-shaped `searchChunks` (stateless, repeatably callable — the contract a future agent calls in
  a loop) and `relatedTo` with MMR diversity so "related" isn't five near-duplicates.
- `scripts/rechunk.js` backfill and a retrieval eval harness (failure rate, recall@5, MRR).

### Deep topics (Gains System, sub-project 1)
- Read *through* one resource chapter-by-chapter: ordered section outline, a "you are here" cursor,
  and **takeaway-first notes** (insight primary, summary optional) with depth-first tangents.
- Source types: book (no file), web, paper, PDF — PDFs can be **hotlinked** (renders in-app, zero
  storage) or uploaded. Books can carry a reference URL.
- "What I learned" view collects every takeaway in section order. Kept separate from the
  breadth-first topic grid.

### Other
- Jump-to-section outline for entry notes (collapsible contents, smooth-scrolls to headings).
- Interview readiness tracker: patterns as topics, problems as entries, coverage×confidence
  readiness across SWE/system-design/quant-trading/quant-dev/APM, with a seeded curriculum.
- Tidy queue (finite one-card-at-a-time triage), catch overlay (`c` from anywhere → Inbox), and a
  PWA share target so the OS share sheet saves straight to Inbox.
- Landing page redesign: story-driven scroll, hand-drawn pencil layer, anime.js hero.
- Server-side feed polling with quality thresholds (score-gated Reddit, points-gated HN) and a
  22-source curated starter pack.
- UI polish: grouped sidebar sections, fixed pin affordance, Explore favicons, resurface widget.
- GitHub opportunity boards fixed — HTML `<a>` links and `##`-heading companies now parse
  (24 broken rows → 192 clean).

---

## 2026-07 — Career, retention, retrieval

- **Career section**: `CareerView` with three tabs, watchlist (search/add/delete), programs
  `opens_at`, replacing the older opportunities/applications nav.
- **SRS Revisit 2.0**: SM-2 spaced repetition over highlights.
- **Flat highlights view**: cross-article searchable quotes; clicking opens the reader.
- Editor formatting bar, in-app Guide, nav extraction + lazy-loaded views.

## 2026-06 — Core system

The bulk of the app (296 feat/fix commits). Major capabilities, grouped:

- **Capture → triage → retain loop**: entries, topics, Inbox with mandatory triage, quick-add,
  bulk import, smart import, conversation capture.
- **Reading & retention**: reader mode over mirrored `full_text`, highlights, revisit scheduling,
  living topic docs, periodic digest.
- **Search**: keyword search plus pgvector semantic search (`entry_embeddings`, `match_entries`).
- **Files**: `FilesView`, `FileRow`, file preview modal, PDF viewer, storage bar with a 500 MB cap.
- **Opportunity radar**: programs/companies watchlist, deadline alerts, scheduled fetchers.
- **Feeds**: RSS/reddit feed widget and view.
- **Archival**: Wayback integration, trash with undo, topic lifecycle (archive/restore/delete),
  entry version history, GitHub backup.
- **Platform**: Supabase auth + RLS, edge functions (`ai`, `enrich`, `capture`, `embed-entry`,
  `send-email`, fetchers), PWA, theme system (4 palettes × 2 styles), command palette, keybindings.
- **Landing page** and marketing scaffolding.

---

## Known gaps

Tracked in `PRODUCTION.md` (launch blockers) and `IDEAS.md` (backlog). Highest-signal:
- Uploads must be removed/gated before multi-user launch — UI removal alone is insufficient, the
  anon key ships to the client, so it requires a storage RLS policy.
- RLS / multi-tenant audit before anyone else signs in; `capture` and `fetch-reels` are hardwired to
  a single `CAPTURE_USER_ID`.
- Chunk retrieval is deployed but unwired (Plan 2); synthesis and the agent chat are unbuilt.
