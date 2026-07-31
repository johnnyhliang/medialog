# Changelog

Feature history for MediaLog, reconstructed from git history (322 `feat`/`fix` commits as of
2026-07-18). Newest first. This file was created retroactively on 2026-07-18 — entries before that
date are grouped by capability rather than by release, since the project has no release tags.

Conventions going forward: add a bullet under **Unreleased** when a feature lands, and cut a dated
section when you deploy. Detailed design rationale lives in `docs/superpowers/specs/`.

---

## Unreleased

### Operator audit log, activation metrics, and a per-account probe
**Migration `0069`.** Three gaps in the founder dashboard, all of which get harder
to add once real users exist.

- **`admin_actions`** — every tier change, pause and emergency stop now prompts for
  a reason and records the flag value **before and after**. That last part is the
  point: undoing an action never requires remembering the old value. A reversible
  control with no record of *why* is a trap — weeks later you find a paused account,
  can't reconstruct what you saw, and "leave it paused" starts to feel like the safe
  choice. It isn't, if they're paying you.
- The table has **RLS enabled with no policies at all** — stronger than a
  founder-only read policy, because it is unreachable from any client key. Verified
  against production with data present: anon `select` → 0 rows, `insert` → `42501`,
  RPC → `42501`. Reads are not logged; opening the dashboard is not an event, and
  recording it would bury the rows that matter.
- **Activation** — the definitions already existed in `supabase/queries/activation.sql`
  and only ever ran by hand. Now surfaced: sorted-inbox-in-week-1 (primary),
  captured-on-2+-days (secondary), captured-at-all. Founders excluded — the operator
  activates by construction, and at small N one row swings the rate double digits.
- **Account probe** — `inspect` on any row answers "what is actually true for this
  account": index health with the verbatim embed error, preservation coverage, usage
  by day, event counts, and every operator action taken on it — without hand-written
  SQL against production. **Counts and statuses only**, never note text, titles, URLs
  or search queries. Being the operator is not a licence to read someone's library.

### Contextualisation cost halved
Batch size 8 → **32**, which is the single largest cost lever in the pipeline:
the entire document is re-sent with every contextualizer call, so cost tracks the
number of **calls**, not the number of chunks.

Measured on the real corpus (4,976 chunks / 396 documents; median 8 chunks per
document, p90 31): batch 8 = 798 calls, batch 32 = 397, batch 50 = 369. **32 covers
90% of documents in one call**, and past that the curve flattens.

The reason it was ever 8 is that an over-large batch degraded **silently** — a model
asked for 32 contexts sometimes returns 20, and the old code padded the rest with
`''`. A context-free chunk is indistinguishable from a good one (same dimensions, no
error), which is exactly how 4,971 chunks were written empty before anyone noticed.
`contextualize.js` now halves and retries on a short answer, keeps whichever attempt
filled more chunks, and is depth-bounded so a model that always answers short
degrades instead of recursing forever. **That guard is what makes the larger batch
safe.** `scripts/rechunk.js` mirrors it, so a re-index and a live save produce
identically-shaped chunks.

### The assistant shortcut is remappable
`Ctrl+/` was hardcoded in `App.jsx`'s keydown handler, firing before the binding
registry was consulted — so it appeared in neither the keybinds editor nor the
command palette, the only shortcut in the app that could be neither discovered nor
changed. It is now an ordinary `commands.js` entry. `Ctrl+K` had the same bespoke
handling for the same reason (both must fire with focus inside an input); that is
now a `whileEditing` flag any command can set, restricted by test to modifier or
chorded keys, since a bare letter that fires while editing makes that letter
untypeable.

### One source of truth for settings tabs
`SETTINGS_TABS` moved next to `SETTINGS_INDEX`; `SettingsView` renders from it. The
index stays hand-maintained on purpose — deriving it from the DOM drifts silently,
and a wrong entry here is visible the moment you search for it. What changed is that
forgetting one is now a **failing test** rather than a setting that quietly can't be
found: every tab must have an entry, every entry must point at a real tab, and
entries must inherit their tab's module gate.

### Fixed: the preservation checker called a working extractor broken
`check-preservation.js` reported **FALLING BACK — the npm: specifiers are not
resolving in Deno** from a single heuristic capture of danluu.com. Verified against
live pages through the production code path: Paul Graham → `readability` 60,000
chars, danluu.com → `heuristic` (correct — it's a link index Readability is supposed
to decline), a 404 → `none`. The extractor works; one sample of a non-article can
never be the evidence. The verdict now reads INCONCLUSIVE and asks for prose
articles.

### Metering, tier limits, and a founder admin dashboard
**Migration `0065`.** Measurement first, enforcement later — a cap guessed before
seeing real usage would be wrong, so AI limits ship **unset** on purpose.

**The finding that shaped it:** `embed-entry` is the cost centre, not chat. It fires
on every entry *save* for every user, whether or not they ever open the assistant.
Capping chat alone would look responsible and change almost nothing.

- `ai_usage` — per user/day/function/model counters. Read-own RLS and **no write
  policy**: writes come from the service role only, because a client-writable usage
  table is a client-defeatable cap. `record_ai_usage()` upserts-and-increments so
  concurrent calls can't lose counts. `model` is `not null default ''` because
  Postgres treats NULLs as distinct in a unique constraint — a nullable column would
  silently create a row per call instead of incrementing one.
- `_shared/meter.ts` — **never throws.** Metering is observability, not correctness;
  a dropped row costs accuracy, a thrown error costs the user their answer. Unknown
  models fall back to a **non-zero** rate, since defaulting to zero would hide real
  spend the moment a paid model is swapped in.
- `ai/index.ts` already received `data.usage` and was discarding it — chat now
  records real token counts. Gemini's `embedContent` returns none, so embeddings are
  estimated at ~4 chars/token and labelled as an estimate.

**`src/lib/limits.js`** mirrors `modules.js`, so "what does each tier get" is a data
edit: free 500 MB / 10 feeds / 24h backups, paid 10 GB / 100 feeds / hourly.
`null` means unlimited, and an *undeclared* key is also unlimited — adding a
dimension can never retroactively restrict an existing tier. **Entry count is
deliberately not limited**; capping capture would poison the core loop.

Enforced in `createFeed` (throws a `LimitError` the UI can turn into an upgrade
prompt rather than a failure) and the `snapshot` function (413 with the real limit).

**`admin-metrics` + `MetricsView`** — founder-only. Server-side because cross-user
aggregation from the client would hit RLS and silently return only the caller's
rows: plausible numbers that are wrong, worse than an error. Founder status is read
with the service role so it can't be spoofed. Tier changes route through
`set_tier_manual()` (`0062`) to keep the founder-never-downgraded rule in one place.
A table, not charts — "who is paying and what do they cost" is a lookup question.
Founder accounts are excluded from cost medians and the UI says so.

**Verified live:** anon → 401 · client `INSERT` on `ai_usage` → `42501` ·
3 concurrent RPCs → 1 row with `calls = 3`.

### Entitlements & modules — gating decomposed into three layers
**Migration `0057`.** Replaces `showFounderFeatures()`, which was three unrelated concerns sharing
one expression (`isDev || founderFeaturesPublic || isFounder(user)`): dev convenience, an ops
kill-switch, and per-account identity. Folding module preferences into that chain would have made a
fourth. Visibility is now the AND of three independent layers:

```
visible = entitled(tier, module) && enabled(prefs, module) && available(flags, module)
```

| Layer | Question | Written by | Storage | Trust |
|---|---|---|---|---|
| Entitlement | is this account *allowed* it? | server / billing | `user_entitlements` | authoritative |
| Preference | did the user *choose* to show it? | the user | `user_configs.modules` | cosmetic |
| Availability | is it shipped / on globally? | ops | `app_flags` | kill-switch |

**Why two tables and not one column.** `user_configs` is user-writable via its `own config` RLS
policy, so a `tier` column there is a free upgrade button. `user_entitlements` has select-own and
**no write policy at all** — writes come from the service role. Migration `0050` had solved the same
problem for `is_founder` with a per-column trigger; this generalizes that rather than contradicting
it, so `tier`/`expires_at`/`source` don't each need their own guard.

**Philosophy.** Showing everything *is* the paradox-of-choice problem. Subtraction is the feature:
ship a lean spine and let power features be opted into. Features map to a **minimum tier**, not a
boolean each — one column beats a widening flag set.

**Expected usage.** Add a module to `MODULES` in `src/lib/modules.js` (`id` is persisted — never
rename it), tag nav items with `module: '<id>'`, and gate routes with `isModuleVisible('<id>')`.
`core: true` modules can't be disabled. Free users see paid modules **locked with an upgrade
affordance** rather than hidden — one registry, better conversion — but `minTier: 'founder'` modules
are hidden entirely, since a locked "Metrics" row advertises an operator surface to everyone.

**Gotcha for developers.** Client-side gating is **cosmetic**. RLS on the underlying tables is the
real enforcement; a forged tier in devtools reveals nav items that lead nowhere. Never move a
security boundary into this layer.

**Grandfathering.** Existing accounts got a `{"__grandfathered": true}` sentinel = everything on.
The lean default set (`home`, `capture`, `topics`, `search`, `settings`, `digest`) applies **at
signup only**. Silently hiding features someone uses daily is the worst possible introduction to a
modules system.

**Founder surfaces reverted to internal.** Career, Interview and the assistant are
`minTier: 'founder'` — they were briefly public via `founder_features_public` purely to demo them.
`0057` flips that flag off and derives founder tier from the existing `user_configs.is_founder` bit
rather than a hardcoded uuid. They are **not** paid features and must never become a paid upsell;
`assistant` is the one to reconsider as `paid` once metering exists.

### Product event tracking — instrumentation that can't be backfilled
**Migration `0058`.** `events(user_id, name, props jsonb, created_at)` plus `src/lib/track.js`.
Shipped *before* AI metering despite the spec ordering it second: metering can be added the week you
launch and lose nothing, whereas week-one cohort behavior for your earliest users is unrecoverable.

`track(supabase, name, props)` is **fire-and-forget** — never throws, never rejects, never blocks the
UI (same contract as `chunkEntryAsync`), no-ops on a falsy client, buffers with a 3s timer + a
`visibilitychange` flush + a 100-row early flush, so a bulk import doesn't fire 200 round trips.

**Hard rule, enforced by test.** No note text, titles, URLs, or search queries in `props` — counts
and bounded enums only. MediaLog is a personal knowledge base; leaking content into an analytics
table betrays the product's premise, and enums answer every question that matters. The assertion
lives in its own `src/lib/track.privacy.test.js` so it can't be collateral damage of an unrelated
edit.

**The five events**, deliberately not more: `entry_created` (`source`), `inbox_sorted` (`count`),
`search_run` (`mode`), `digest_opened`, `topic_created`.

**Activation metrics** in `supabase/queries/activation.sql`. Primary: *sorted the inbox at least
once in week one* — sorting is when the app stops being a bookmark pile, and it's the behavior you
can design toward. Secondary: *captured on two separate days* — sorting proves comprehension,
returning proves habit, and the second is usually the better retention predictor.

### Article preservation — a real extractor and an unambiguous coverage marker
**Migration `0060`.** `enrich` now extracts with `@mozilla/readability` + `linkedom`, factored into
`supabase/functions/_shared/extractArticle.ts` with **the DOM and parser injected**, which is what
lets one module run under Deno, Node and vitest. Chain: Readability → the old regex heuristic →
nothing, gated at `MIN_ARTICLE_CHARS` (500) so cookie walls and paywall stubs fall through instead
of being stored as "preserved".

**Why a status column.** `full_text = null` meant both *never attempted* and *attempted, nothing
extractable*. You cannot compute coverage from an ambiguous null. `full_text_status`
(`ok`/`empty`/`failed`/null), `full_text_extractor` and `full_text_at` disambiguate, so
"how much of my library is preserved" is one query. `src/lib/preservation.js` centralizes the
mapping (`preservationPatch`) and mirrors the SQL client-side (`preservationCoverage`).

**Bug found and fixed:** `enrichEntries` only ran when title or image were missing, so bulk imports
arriving *with* titles never preserved text at all.

**Backfill:** `scripts/backfill-full-text.js`, resumable off the marker itself (queue = "status is
null", no cursor file), with `--retry/--rps/--limit/--dry-run/--coverage`.

**Critical developer note.** `full_text` is a chunk **source** in `chunkEntry.js` (`sourcesFor`).
Because `chunkSource` hash-guards on an FNV-1a `source_hash`, **improving extraction invalidates
those hashes and forces re-embedding.** That's why `--rps` throttles the re-chunk *inside* the loop
rather than just the HTTP fetches. Coverage status says nothing about index freshness — there is
still no per-entry index status (see `docs/tech-debt.md`).

**⚠️ Unverified.** Deployed 2026-07-29, but the `npm:` specifiers have never resolved at runtime.
The imports are lazy and try/caught, so failure degrades silently to the heuristic — the dangerous
kind. Verify with one capture, then check `full_text_extractor = 'readability'`.

### Interview tracker — SRS activated, pace, and gap synthesis
**Migration `0061`.** The SRS scaffolding was already paid for and idle: `sm2()`/`rateRevisit()`
existed and wrote `surface_after`, but were wired only to the generic Revisit flow. `listInterview`
didn't even select `surface_after`, while `masterySignal` read `srs_ef` as a fallback — a value that
path never wrote. So `patternReadiness` had no time dimension at all: a pattern solved in March
scored identically to one solved yesterday.

- **Scheduling** — rating a solved problem now schedules its review (`scheduleReview` →
  `confidenceToGrade` → the existing SM-2). Rating is the right hook because it's the only moment a
  fresh recall signal exists. Confidence 1–2 maps to an SM-2 *failing* grade deliberately: rating
  something "barely understood" and then not seeing it for a month is the exact failure this
  prevents. Scheduling failures are caught separately so they can never lose the rating itself.
- **`src/lib/interviewPlan.js`** — pure, injected-clock functions. `dueReviews`,
  `patternStaleness` (overdue fraction, shown *beside* readiness rather than folded in, so it's
  clear which of the two is the problem), `paceStatus` (required vs actual problems/week; a rate
  converts into a decision about today, a percentage doesn't; `no_target` is first-class so pace
  stays opt-in and doesn't nag), and `suggestNext`.
- **`suggestNext` precedence** — due reviews outrank all new work (retention beats volume, capped at
  3 so it can't eat the set), then the weakest pattern's **easiest** unsolved problem. Difficulty is
  a ladder, not a filter: a hard problem in a barely-covered pattern teaches helplessness. Gates cap
  consecutive picks from one pattern; the set is finite and an empty result means **caught up**,
  which is the goal, not a failure — callers must not pad it.
- **`identifyGaps`** returns a **kind** per gap — `uncovered` (needs new problems), `stale` (needs
  recall), `shaky` (needs re-learning). Collapsing these into one readiness number is what makes a
  tracker accusatory instead of useful: it says you're behind without saying what to do.
- **Pivoting is data, not a migration.** `user_configs.prep_focus` + `trackWeightsFromFocus` are the
  lever: change focus and readiness ordering, gaps and suggestions all re-derive from untouched
  problems. No focus weights every track equally rather than silently guessing one.

**No streaks, deliberately.** A streak punishes a deliberate rest day and turns a learning tool into
a guilt engine. Cadence is measured for pace, never displayed as a chain.

**Not yet built:** the UI (readiness rings, staleness dot, gap list, target-date/focus editor).

### Payment infrastructure — built, deliberately inert
**Migration `0062`.** `subscriptions` (read-own RLS, service-role writes) and
`sync_tier_from_billing()` as the single authority mapping billing state to tier. Nothing charges
anyone: `app_flags.billing_enabled` ships **false**, there is no provider key, and the webhook
handler isn't written.

**Why build it off.** The parts that are painful to retrofit are exactly the ones that must be
correct before real money and real accounts exist. Both failure directions are quiet: granting paid
to a lapsed account loses revenue invisibly, revoking it from a paying customer loses the customer.

**The founder guard is load-bearing.** A manual founder grant is *never* downgraded by a billing
event. Without it, a lapsed test subscription would strip the operator's own access — and the
operator is the least likely to notice, being used to seeing everything.

**`src/lib/billingPlan.js`** holds the mapping as pure functions: `active`/`trialing` → paid;
`cancel_at_period_end` keeps access until the period actually ends because it was paid for;
`past_due` keeps access for a **7-day grace window** (the usual cause is an expired card, not a
non-paying user); `past_due` with no period end **refuses** rather than granting indefinitely; and an
**unrecognized status defaults to free**, so a future provider status can never grant paid.
`billingState()` is separate from tier because entitlement and messaging differ — a `past_due` user
still has access but needs to hear about it.

**Expected usage / harness.** `node scripts/set-tier.js <email> free|paid|founder` (needs
`SUPABASE_SERVICE_ROLE_KEY`) sets a tier by hand, so paid surfaces are testable today with no
provider. That's what makes "built but off" workable, and turning real billing on later changes
nothing about how tier is consumed in the app.

### Editable tools & links shelf
**Migration `0056`.** `quick_links` replaces three hardcoded URLs in `QuickLinksWidget`. The design
point: each link carries a **note**, and search matches note *as well as* label — these are tools you
reach for by what they *do* long after forgetting what they're called, so "compress" has to find
ihatepdf.cv. Search input appears past 4 links.

### Feed categories — canonicalized, pickable, re-filable
Adding a feed with a hand-typed category silently forked the sidebar: grouping is an **exact string
match**, so `Writers` or a trailing space created a second group beside `writers`. Categories are
legitimately user-defined, so the fix isn't a fixed taxonomy — `src/lib/feedCategories.js`
canonicalizes on write (trim, collapse inner whitespace, reuse an existing spelling that matches
case-insensitively) and the form offers what exists, with free text behind **+ new category**.

Also adds a per-feed category select and an explicit **edit** toggle in the sidebar header. The
actions were previously hover-only (`.feed-nav-actions` was `opacity: 0`), which made both the
category picker and delete **unreachable on touch** and undiscoverable on desktop. There was
previously no way at all to re-file a feed without deleting and re-adding it.

### "Start Here" tutorial topic
`src/lib/starterTopic.js` seeds an empty account with seven worked-example entries covering capture →
inbox → semantic search → deep topics → digest → customization. The guide stays **reference**; this
is the tutorial. Teaching by being a populated topic you read beats a click-through tour, and the
last entry tells the user to delete the topic — that's the intended ending. Seeded from
`refreshTopics` when only Inbox exists, name-guarded so it never re-seeds, catch-swallowed so a seed
failure can't break load. Copy lives in a plain array; edits need no migration.

**Known cost:** starter content re-embeds per signup on the shared key. Precomputing those vectors
(template rows + a service-role copy on signup) is the fix, not built.

### Mobile — topic grid no longer squeezed
`.home-view` sets `align-items: flex-start`, which stops stretching children once the mobile query
flips `flex-direction: column` — `.home-left` collapsed to its content width and topic cards
rendered ~55px wide. Fixed with `align-items: stretch`, full-width `.home-left`, and a real
2-column grid (the container query only fires below 312px, which phone widths clear).

### Tooling — vitest was crawling agent worktrees
`.claude/worktrees/` carry their own `node_modules`, so vitest collected a second copy of every test
**and a second React**, failing with `Cannot read properties of null (reading 'useState')`. Excluded
in `vite.config.js` and gitignored. A stale `feat+feed-widget` gitlink was also tracked in the repo
and has been removed.

### File archiver (Phase 1) — owned copies of hotlinked files
Beat link rot: a `snapshot` edge function fetches a hotlinked image/PDF/media file with the service
role and stores an owned copy in a private `snapshots` bucket, deduped by SHA-256 content hash
(`snapshots` table, migration `0054`; `src/lib/db/snapshots.js`). In **Files → Hotlinked**, each row
gets a **“save copy”** action that flips to **“archived ✓”** and opens the owned copy via a signed
URL. 25 MB cap; only image/pdf/audio/video content types. Phase 2 (self-contained full-page
snapshots via a `monolith`/SingleFile worker) is scoped in `IDEAS.md`, not built.

### Files page — Hotlinked overview
New **Uploads / Hotlinked** tabs on the Files page. “Hotlinked” scans every note for
externally-referenced images/PDFs (markdown images, media links, bare media URLs), excludes Storage
uploads, dedupes, and lists each with a thumbnail + jump-to-entry buttons (`src/lib/hotlinks.js`).

### Feed — reliability, relevance, and sources
- Replaced the flaky client-side allorigins RSS fetch with the server-side `fetch-feeds` function
  (self-contained RSS/Atom parser after `deno.land/x/rss` silently choked on several sources);
  Reddit switched from the now-403 `top.json` to the working `top.rss`; 40-items-per-source cap so a
  firehose (arXiv) can’t drown the feed.
- Algorithmic **relevance ranking**: interest profile from topics + tags + recurring words in recent
  entry titles; **Relevant** is the default sort with an **“only matches”** filter and a per-item
  ★score; plus a per-item text filter (`src/lib/feedRelevance.js`).
- New **creators/writers** feeds (migrations `0052`/`0053`): George Hotz (streams), ThePrimeagen
  ×2, aligrithm.com, Tsoding, Jonhoo, Low Level, Karpathy, Casey Muratori, Xe Iaso, Drew DeVault,
  Antirez, ryg — all verified active.

### Career — Boards tab
New **Career → Boards** tab: curated auto-updated GitHub job lists (Simplify, vanshb03, Ouckah,
speedyapply, NW FinTech quant), new-grad lists, and a hotlink to the standalone ApplyKit dashboard.
Opportunities (radar) now refresh from source on open, throttled to once per 8h.

### Persistent assistant + founder rollout
- **Ask-your-library** conversations persist to Supabase (`assistant_conversations` /
  `assistant_messages`, migration `0049`) with a history sidebar; sync across devices.
- DB-backed founder flag (`user_configs.is_founder`, migration `0050`) so gating works without a
  rebuild; runtime `app_flags` kill switch (migration `0051`) makes Career + Ask-your-library public.
- PWA now auto-updates on new deploys (workbox `skipWaiting`/`cleanupOutdatedCaches` + hourly check).

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
