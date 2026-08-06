> **⚠️ Superseded in part — 2026-07-29.** Part (a) `full_text` shipped (see CHANGELOG).
> Parts **(b)** server-side full-page snapshots and **(c)** `yt-dlp` are **replaced** by
> `docs/preservation-v2-spec.md`, which inverts the core assumption: capture happens
> **client-side in a browser extension**, not server-side in a headless browser. That single
> change makes login-walled pages solvable, removes the Chromium container entirely, and
> delegates public-page fidelity to the Wayback Machine. Read v2 first; keep this file for the
> Phase 1 archiver details and the (a) task history.

# Content Preservation — Implementation Plan

Status: ⚠️ **PARTIALLY BUILT** — corrected 2026-08-06. Shipped: the `snapshots`
bucket and `snapshot` function (images/PDFs), article text via `enrich` +
Readability, and `preservationPatch`. Not shipped: `preservationCoverage` has no UI,
`scripts/backfill-full-text.js` has never been run against real data, and Wayback
submission records unverified successes. **Also known now, and not reflected below:**
entries created by the capture endpoint are never enriched at all, and wiring that
up naively would store paywalls as article text — see `docs/tech-debt.md`.
`PROJECT-STATE.md` §3.3 has the tier-by-tier state.

Goal, as written: stop losing important articles and videos when they get taken
off the internet. Snapshot-at-save on your own storage, tiered by content type. Phase 1 (hotlinked
image/PDF archiver) is **already shipped** (`snapshots` table, `public-share`… no —
`snapshot` edge function, migration 0054). This plan covers article text and full pages/video.

---

## (a) Article `full_text` preservation — **hardened (T1/T2/T3/T5 done)**

**Shipped:** Mozilla Readability extraction, coverage markers, and a resumable backfill.

- `supabase/functions/_shared/extractArticle.ts` — all extraction logic, dependency-free and
  unit-tested. The DOM + Readability are *injected* (`makeReadabilityParser`) so the same module runs
  under Deno (`enrich`, via `npm:@mozilla/readability` + `npm:linkedom`), Node (the backfill), and
  Vitest. Fallback chain: **Readability → regex heuristic → nothing preserved**. Never throws.
  `MIN_ARTICLE_CHARS` (500) is the gate that treats a cookie wall / paywall stub as "not an article".
- `enrich` returns `full_text`, plus additive `byline` / `excerpt` / `full_text_extractor`. Existing
  response keys are unchanged. If the `npm:` specifiers ever fail to resolve at runtime, it logs and
  degrades to the heuristic rather than failing the call.
- **Coverage markers** (migration `0060_full_text_coverage.sql`): `full_text_status`
  (`ok` | `empty` | `failed` | null = never attempted), `full_text_extractor`, `full_text_at`.
  A null `full_text` alone could not distinguish "never tried" from "nothing extractable"; the status
  column is what makes coverage answerable in one query. Written by every capture path
  (`src/lib/preservation.js` → `preservationPatch`) and by the backfill.
- **Coverage query** — one query, run as the signed-in user:

  ```sql
  select
    count(*)                                            as url_entries,
    count(*) filter (where full_text_status = 'ok')      as preserved,
    count(*) filter (where full_text_status = 'empty')   as unextractable,
    count(*) filter (where full_text_status = 'failed')  as failed,
    count(*) filter (where full_text_status is null)     as not_attempted,
    round(100.0 * count(*) filter (where full_text_status = 'ok')
          / greatest(count(*), 1), 1)                    as pct_preserved
  from entries
  where user_id = auth.uid() and deleted_at is null and url is not null;
  ```

  `node scripts/backfill-full-text.js --coverage` prints the same numbers.
  `preservationCoverage()` in `src/lib/preservation.js` mirrors it client-side for already-loaded
  entries (for the UI count in T3, still to be surfaced).
- **Backfill:** `scripts/backfill-full-text.js`. Resumable (queue is "status is null", so an
  interrupted run resumes; `--retry` re-attempts `empty`/`failed`) and rate-limited (`--rps`, default
  2, or `BACKFILL_RPS`). The rate limit is load-bearing: better extraction changes the extracted
  text, which changes the FNV-1a `source_hash` in `content_chunks`, so **every backfilled entry
  re-embeds**. Re-chunking happens inside the same throttled loop (reusing `processEntry` from
  `scripts/rechunk.js`) so the embedding burst is bounded by `--rps` too. `--dry-run` and `--limit`
  for rehearsal.

**Still open:** T4 ("preserve text now" per-entry action) and the T3 *UI* surface (a ◆-style marker
and an "N preserved / M total" count in Settings/Files). The data behind both now exists.

---

### Original scoping notes

**What exists today:** the `enrich` edge function already runs `extractReadableText(html)` and returns
`full_text`, which `App.jsx` stores on the entry at capture (App.jsx:452, 496). Reader mode renders
it (`ReaderModal`), and it's a first-class chunk-retrieval source (`chunkEntry.js`
`ALL_SOURCES = ['full_text','note','takeaway']`). So a captured article's text **already survives the
page dying** — for pages the current extractor handles.

**The gaps (this is the actual work):**
1. **Extractor quality** — `extractReadableText` is a lightweight HTML text pull, not full Mozilla
   Readability. Upgrade to a real readability port (e.g. `@mozilla/readability` via a DOM shim, or
   `jsr:@paoramen/cheer`… evaluate Deno-compatible options) for clean article body + byline + excerpt.
2. **Coverage/verification** — no visibility into which entries actually have `full_text`. Add a
   marker (like the Explore ◆ embedded dot) and a Settings/Files count of "N links preserved / M
   total." Backfill: a one-off pass to enrich old URL entries missing `full_text`.
3. **JS-heavy / paywalled pages** — `extractReadableText` gets an empty/garbage body. Fallback chain:
   readability → (Phase 2) monolith full-page snapshot → store nothing but flag "couldn't preserve."
4. **Re-capture on demand** — a "preserve now / re-fetch text" action on an entry for when the first
   pull failed or the article changed.

**Tasks:**
- T1. Swap `extractReadableText` for a real readability extractor in `enrich` (or a new
  `extract-article` fn); return `{ full_text, byline, excerpt }`.
- T2. Ensure capture always attempts it for URL entries (verify the App flow covers all capture paths:
  QuickAdd, bulk import, share-target, migration).
- T3. `full_text` coverage marker + count; backfill script for old entries.
- T4. "Preserve text now" action on an entry (re-invoke enrich).
- T5. Tests for the extractor on a few real article fixtures.

Cost: one fetch+parse per captured link — negligible. No worker needed (runs in the edge function).
**This is the cheapest, highest-value preservation win and should go first.**

---

## (b) Full-page + media preservation — Phase 2/3 (needs a worker)

Edge functions can't run a headless browser or a binary, so these need a small companion worker
(Fly.io/Railway container, ~free tier). Both write owned copies into the `snapshots` bucket and rows
into the `snapshots` table (kind `page` / `media`), reusing Phase-1 infra.

### Phase 2 — Full-page snapshots (`monolith` / SingleFile)
- A worker exposes `POST /snapshot-page { url }` → runs `monolith` (Y2Z/monolith, ~15k★) or
  `single-file-cli` → returns one self-contained `.html` (all CSS/JS/images inlined).
- The `snapshot` edge function (or a new `snapshot-page`) calls the worker, stores the HTML blob,
  inserts a `kind='page'` snapshot row. Entry shows a "📄 page archived" chip → opens the owned copy.
- Covers articles at full fidelity (layout + images), beyond just the text from (a).
- Fallbacks if the worker is down: Wayback **SPN2** (`web.archive.org/save/{url}` — the real *save*
  endpoint, not the availability API MediaLog used) and/or archive.today submit; store the returned
  snapshot URL instead of an owned file.

### Phase 3 — Video/audio preservation (`yt-dlp`)
The "I lost a YouTube video" case. Same worker, `POST /snapshot-media { url, fidelity }` running
`yt-dlp`, three fidelity tiers (cheapest first — this is the key cost lever):
- **transcript + thumbnail + metadata** (default) — tiny, usually preserves the *value*; store as a
  text entry + image. Use `yt-dlp --write-auto-sub --skip-download` + oEmbed thumbnail.
- **audio-only mp3** (~1/10 of video size) — for talks/podcasts.
- **full video mp4** — opt-in per item; large, so gate it and warn on storage.
Store in the `snapshots` bucket; `kind='media'`; entry shows a "▶ archived" chip.

**Storage note:** transcripts/audio are cheap; full video is not — default to transcript, make
audio/video explicit per-item choices. Add a storage-usage view so it never surprises you.

**Decisions:** (1) worker host (Fly.io free tier recommended); (2) default video fidelity (recommend
transcript); (3) auto-preserve-on-save for pages/media vs on-demand button (recommend: text auto
(a), pages/media on-demand to control cost/storage).

---

## Overall order

1. **(a) full_text hardening** — no infra, cheap, biggest immediate win against article rot.
2. **Phase 2 monolith worker** — owned full-page snapshots.
3. **Phase 3 yt-dlp** — video/audio/transcript, reusing the same worker.

Phase-1 files archiver is done; (a) is the natural next step and needs no new infrastructure.
