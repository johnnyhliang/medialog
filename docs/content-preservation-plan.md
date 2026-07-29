# Content Preservation — Implementation Plan

Status: **scoping, not built.** Goal: stop losing important articles and videos when they get taken
off the internet. Snapshot-at-save on your own storage, tiered by content type. Phase 1 (hotlinked
image/PDF archiver) is **already shipped** (`snapshots` table, `public-share`… no —
`snapshot` edge function, migration 0054). This plan covers article text and full pages/video.

---

## (a) Article `full_text` preservation — mostly already built, needs hardening

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
