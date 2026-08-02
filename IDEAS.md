# MediaLog — Ideas & Open Threads

Living scratchpad of proposals, big swings, cuts, and handoff notes. Not a spec: nothing here
is committed work. Promote items into `docs/superpowers/specs/` when they get real.
(Companion docs: north-star spec for the philosophy/build order, `BRAND.md` for visual identity.)

★ = would genuinely prioritize.

---

## Roadmap — replace Obsidian + NotebookLM

The bet: MediaLog already owns ~70% of what people use Obsidian for (markdown notes, topics-as-folders,
keyword+semantic+tag search, GitHub backup / markdown export) and the *hard* part of NotebookLM
(grounded Q&A — the **Ask-your-library** assistant is RAG over `content_chunks` with citations). The
gaps are a handful of well-scoped builds, not a rewrite. Ordered by leverage:

### ① Fast synthesis (NotebookLM's core) — ★ build first, cheapest
One-click **Summarize / Briefing doc / Study guide / Timeline / FAQ** over a topic or a selected set of
entries. Almost free: it's structured prompts over the *existing* retrieval (`searchChunks` /
topic entries) → the `ai` edge function already deployed. Output rendered as a new note/entry with
citations back to sources. Directly replaces NotebookLM's most-used feature.
- Build: `src/lib/db/synthesize.js` (prompt templates + retrieval), a "Synthesize ▾" action on
  TopicView, render result as a takeaway/entry. Reuses `ai.js` + `librarian.js` patterns.
- Cost: one LLM call per synthesis, bounded by retrieved passages. Negligible.

### ② Wikilinks + backlinks (the real Obsidian-replacement piece) — ★
Typed `[[entry]]` links between entries plus a **"Linked from"** backlinks panel. Today we only have
*semantic* Related Entries (`relatedTo`); explicit links are what Obsidian users actually miss.
- Build: parse `[[...]]` in notes → resolve to entries (autocomplete on `[[`); an `entry_links`
  table (or derive on read); a backlinks section on the entry/reader. Pairs with the graph view (④).

### ③ Audio Overview / podcast (the wow feature) — heavier, gated on TTS
Two AI hosts discussing your sources, à la NotebookLM. Pipeline: LLM writes a 2-voice dialogue script
from retrieved passages → TTS with two distinct voices (Gemini TTS / OpenAI / ElevenLabs) → stitch to
one MP3 → store in a bucket → in-app player. Same "can't run in an edge function" constraint as the
page archiver (needs a small worker for audio stitching), plus per-minute TTS cost — so gate it behind
a button, not automatic. Store generated episodes in Storage keyed by topic + source hash so re-runs
are cheap.

### ④ Graph view — nice-to-have once links exist
Force-directed graph of entries connected by wikilinks (②) and/or semantic neighbors. Low priority
until ② lands; mostly a visualization over data ② already produces.

### Also on the Obsidian side (smaller)
- **Daily note / journal surface** — a real daily entry (Inbox is close but not a journal).
- **Entry permalinks** — URL-addressable entries (`?entry=<id>` opens the topic + scrolls) so an
  entry can be hotlinked/shared; today navigation is in-app state only, not routed.

---

## Big swings

- ★ **Collapse Deep Topics into normal topics** — *a correction to shipped code, not
  an extension.* Deep Topics being a separate topic kind, hidden from the main grid,
  was the mistake: it forces "PyTorch internals" to live in a different universe than
  "ML," when in your head they are the same thing. One topic, sometimes partly
  structured (reading TVM chapter by chapter) and mostly not (saved links, quick
  notes). Two containers for one mental bucket is exactly the fragmentation this app
  exists to prevent.

  The shape: any topic can optionally carry one or more **resources** (a resource =
  a source + an ordered outline + a cursor). "ML" stays one topic with its usual
  scattered entries plus zero or more active resources ("TVM paper", "ONNX spec").
  A takeaway written against a resource section is a **normal entry** in that topic's
  list — same grid, same search — carrying a small tag (`TVM · §3`) instead of living
  in a walled-off tab; clutter is handled by making that tag a *filter*, not a
  separate universe. Quant stops being special-cased too: a topic with an order-book
  resource whose "sections" are build rungs, plus the Strand B/C reading reps as a
  second lightweight resource or plain entries. One mechanism, not three. The
  picker's job barely changes — "pick a topic with an active resource whose cursor
  has a next todo section" replaces "pick a Deep Topic vs a menu_item".

  Cost, honestly: this reworks `topics.kind`, `DeepTopicView` as an isolated route,
  and the `listTopics` grid filter. Real but contained — `resource_sections` mostly
  survives, the outline+cursor UI becomes a panel inside the normal topic view, and
  the grid-hiding filter goes away entirely. **Sequence this first**, before any
  recommendation work; everything downstream is easier to reason about with one
  topic shape instead of two.

- **Topic-aware feed (recommended content / other takes)** — a genuinely different
  capability from the picker, and additive. Two pieces, neither blocking the above:
  1. *Passive boost* — feed ranking already has a designed `t_focus` layer
     (north-star Part 5); once a topic has an active resource, related items should
     rank higher in the regular feed, so "other takes" surface on their own during
     Drift-mode browsing instead of requiring you to ask.
  2. *Active pull* — a "find more like this" action reusing the RAG/agent infra,
     dropping candidates into that topic's backlog to skim. **Never auto-added** —
     always your call to promote.

- ★ **The Morning Open** — one composed daily screen (feed picks + a resurfaced highlight +
  tidy count + "you were reading X") designed to be the first thing you open instead of Discord.
  The Today idea taken to its conclusion: one screen that *is* the habit.
- ★ **Reading positions everywhere** — track % through every `full_text` article; progress
  rings on entries; "continue reading" is the app's strongest pull and feeds resume cards free.
- **Weekly "you" recap** — auto-generated Sunday page: saved / read / highlighted, which
  interests grew; shareable as an image. The user_model made visible and delightful.
- **Topic timelines** — a topic rendered as a chronological strip of entries/highlights/notes;
  three months of a learning journey in one glance. The "wow" screen the app lacks.
- **Voice catch** — hold-to-record in the PWA, Whisper → Inbox note. Side-thoughts arrive while
  walking; typing is the friction.

## Medium features

- **Content preservation (Phase 2/3)** — beat link rot / taken-down media. Phase 1 (hotlinked
  image/PDF archiver → owned copies in the `snapshots` bucket) is **shipped**. Next: **(a)** harden
  auto `full_text` capture so dead *articles* stay readable (mostly already exists via `enrich` →
  `extractReadableText`; needs a real readability extractor + coverage marker + backfill), **(b)
  Phase 2** self-contained full-page snapshots via a `monolith`/SingleFile worker, **(c) Phase 3**
  YouTube/video via `yt-dlp` (transcript+thumbnail default, audio/full-video opt-in — the cost lever).
  Pages/media need a small always-on worker (edge functions can't run a browser/binary). Full plan:
  `docs/content-preservation-plan.md`.
- **Intentional app: reminders + modularity + calm review** — replace a separate todo app with
  org-mode-flavored reminders that are just entries with a `due_at` (no new pile); make every surface
  a Settings toggle so people use only what they need (module registry + `user_configs.modules`,
  generalizing founder gating); and defeat paradox-of-choice with a bounded, closeable "Today /
  Morning Open" screen + per-topic synthesis so you digest instead of doom-scroll. Full spec:
  `docs/intentional-app-spec.md`.

- **Semantic feed relevance** — the feed currently ranks items by keyword overlap between an
  item's title/summary and an interest profile (topics + tags + recurring words in recent entry
  titles), with a "Relevant" default sort and an "only matches" filter that hides zero-signal
  items (see `src/lib/feedRelevance.js`, `FeedView`). Keyword matching is cheap and instant but
  leaky — it misses "LLM inference" when your notes say "model serving," and can't tell a strong
  paper from a weak one beyond literal words. Upgrade path: embed each feed item (reuse
  `embed-entry` / the chunk pipeline) and score by vector similarity to the user's library
  instead of token overlap; blend with the keyword score as a fallback. Cost/latency tradeoff:
  every polled item needs one embedding call, so gate it (e.g. only embed items that pass a
  cheap keyword prefilter, or only for high-volume "paper" feeds). Would make the "filter out
  low-signal papers" case actually work. Keep the keyword version as the offline/free default.


- ★ **Reader mode as the default click** — link entries open straight into reader + highlights;
  the app becomes where you *read*, not just where you file.
- ★ **Related-entries footer** (north-star step ④) — semantic neighbors on every entry;
  retroactively justifies every past save.
- **Daily language card** — turn saved Korean/Mandarin snippets into a daily SRS card
  (srs tables exist). Your own material beats generic Anki decks.
- **Deadline radar unification** — opportunities, snoozes, price-drops share one "expiring
  soon" strip on Home instead of three scattered surfaces.
- **Entry merge/dedupe** — fuzzy-match near-duplicate URLs/titles as a tidy-queue session type.
- **Keyboard-first triage** — number keys assign top-9 topics in Sort/Tidy, `d` done `s` snooze;
  triage at typing speed.

## Aesthetic / experience

- ★ **One signature moment** — make "all tidy" and inbox-zero genuinely beautiful (small
  generative flourish, Fraunces display). The emotional payoff screens deserve the budget.
- **Favicon-everywhere consistency** — same treatment in EntryCards, feed, search as Explore.
- **Density toggle** — compact desktop / comfortable mobile (already in tuxedo spec).
- **View Transitions API** — soft cross-fades between views; most of what makes native feel native.
- **Mobile bottom tab bar** — four tabs matching the four moods (Today / Catch / Library /
  Review); the sidebar is a desktop pattern.

## Integrations

- ★ **Obsidian / Notion import** — the switching funnel (below).
- **Readwise import** — instantly fills Highlights/Resurface with the user's own data; the app
  feels alive on day one.
- **YouTube watch-later** — video URL → transcript → highlightable like an article.
- **Monday email** — 3 resume cards via send-email. Skip Slack/Discord bots (they return you to
  the apps you're escaping).
- **MCP server** — "Claude, save this / what do I have on X" from any Claude surface.

## Switching story

- ★ Import isn't a feature, it's the funnel: Obsidian vault, Notion export zip, OneTab,
  bookmarks HTML, Readwise CSV — each ~a day on BulkImport scaffolding, each a community to
  demo "migrate in 5 minutes" to.
- The pitch: not another notes app — **"the app that tells you where you left off."** Nobody
  owns retention/resume.
- Export parity as a loud landing promise: leave anytime, everything in markdown.

## Known follow-ups

- **SimplifyJobs boards use HTML `<table>`, not markdown** — the github.ts parser
  (markdown-pipe + heading-company) recovers vanshb03 + northwesternfintech but skips
  SimplifyJobs Summer2026/New-Grad entirely (the biggest SWE boards). Add an HTML-table
  branch: match `<tr>…</tr>`, pull `<td>` cells, reuse cellText/extractLink. Fixed 2026-07-06:
  HTML `<a href>` links + `##`-heading companies; SimplifyJobs HTML tables still TODO.

## Launch readiness — metering, analytics, unit economics

Ordering is the whole point here: **instrumentation can't be backfilled.** Every day in
production without event capture is behavior data that's gone for good. The dashboard is the
easy part and should come last.

### ① Per-user AI metering — ★ build first, blocks everything else
Today every AI call runs on one shared key: `ai/index.ts` reads `AI_API_KEY` from deploy env,
`embed-entry` reads `GEMINI_API_KEY`. Callers are authenticated but **not metered or rate
limited** — one user can drain the quota for everyone.

- `ai_usage(user_id, day, function_name, calls, input_tokens, output_tokens, est_cost_usd)`
- Written by the edge functions — they're the only layer that knows real token counts.
- Cap check in `ai/index.ts` before the provider fetch; free tier gets N/month.
- Unblocks: tier enforcement, the import queue's backpressure, and the one number pricing
  depends on — *what does the median user cost me*.

**BYO-key is not the monetization model.** It inverts value capture (the user willing to manage
a Gemini key is the least likely to pay, and you've just told them AI is free), it walls off
the first-session magic moment, and you still eat the support burden. Offer it as a free-tier
escape valve for power users, never as a paid SKU. Price on value: ~$8–12/mo for uncapped AI +
interview tracker + sharing + storage. Inference is cents; the story "we charge $10, it costs
us $0.40" is the one that reads as a business.

### ② Product events — gated on defining the activation metric
Thin `events(user_id, name, props jsonb, created_at)` + one `track()` helper. Keep the list
short and funnel-shaped: `entry_created` (source: paste/capture/import), `inbox_sorted`,
`search_run` (semantic vs keyword), `digest_opened`, `topic_created`.

Likely activation metric: **sorted the inbox at least once in week one** — the moment the app
stops being a bookmark pile. Pin this down before instrumenting; it decides what's worth
logging.

### ③ Internal admin dashboard — last, once there's data worth looking at
> Full build spec: `docs/metering-analytics-spec.md`

Mostly SQL over ① and ②: cohort retention, DAU/WAU, cost per active user, gross margin by
tier. Ship as a route behind the existing founder flag (`0050_founder_flag.sql`,
`featureFlags.js`), not a separate app.

**Cost caution:** unit economics here are probably *not* AI-dominated. The file archiver's
`snapshots` bucket (25 MB/file) plus Supabase egress will likely outrun inference. Track bytes
stored per user next to API calls or you'll optimize the wrong line.

### Related: embeddings are derived, never exported
`githubSync.js` already excludes `content_chunks` (megabytes of churn, rebuilt by
`scripts/rechunk.js`) — extend that rule to every export path. Vectors are a cache tied to a
specific model + `chunkConfig.js`; exporting them creates silent search corruption after any
model change. **Don't offer a user toggle** — it asks users to reason about something they
can't evaluate. Recompute cost is near zero anyway: `chunkSource` hash-guards on `source_hash`,
so re-importing indexed content makes zero API calls. The real risk is burst, not spend — fix
it with an import queue (mark entries unindexed, drain a few per second), which also gives ①
its natural backpressure hook.

## Cuts / quiet retirements

- Market, weather, clock widgets — dashboard filler diluting the Today thesis.
- Instagram Reels pipeline — fragile (session cookie), high maintenance; park unless used weekly.
- Bulk Import + Import as two nav items — merge into one surface with tabs.
- Digest vs Progress vs Manager — once Manager ships, fold Progress in; Digest becomes the
  weekly recap only.

---

## Draft: the Resurface algorithm (beyond FIFO Revisit)

**Goal:** every day, surface a handful of things from your own corpus that feel *chosen*, not
random — and never slop. Sits on top of Revisit/SRS, doesn't replace it (SRS keeps owning
deliberate retention reps; Resurface owns serendipity).

### Candidate pools (in priority order)

1. **SRS-due highlights** — anything the SM2 tables say is due (non-negotiable, always first).
2. **Proven-value items** — entries you highlighted, annotated (note ≥ some length), or
   finished reading, aged 30+ days. You already voted these mattered.
3. **Buried gems** — entries saved with a note but never opened since; oldest first.
4. **Momentum echoes** — entries semantically near your *currently warm topics* (embedding
   similarity to active-topic centroid) regardless of age.

### Scoring (per candidate, weights are data not code)

```
score = w_evidence · evidence          (highlighted=1.0, noted=0.7, finished=0.6, merely saved=0.2)
      + w_focus    · focus_similarity  (cosine vs. warm-topic centroid, 0–1)
      + w_age      · age_curve         (bell peaking ~60–180d: old enough to have forgotten,
                                        not so old it's irrelevant)
      + w_novelty  · resurface_gap     (penalize if surfaced in last N days; hard-exclude < 14d)
      - w_fatigue  · topic_repeat      (already showed this topic today/this week)
```

Weights live in a per-user `resurface_config` JSON row — **adaptability requirement**: tuning
is a settings edit or an AI-agent proposal, never a deploy.

### Anti-slop gates (hard filters, before scoring)

- **Evidence floor:** never resurface an item with zero engagement signal (no note, no
  highlight, never opened) *unless* it's in the buried-gems pool explicitly labeled as
  "you saved this and never looked — keep or toss?" (that's a tidy prompt, honest about itself,
  not fake serendipity).
- **No un-triaged feed items.** Feed items that were never saved into a topic are noise by
  definition (Source ≠ System guardrail).
- **Taste filter:** score item text against the user_model's dismiss-pattern signals (once ⑥
  exists); below threshold → excluded even with good metadata.
- **Diversity quota:** max 1 item per topic per day, ≥2 distinct topics in any day's set.
- **Volume cap:** ≤3 resurfaced items/day total across all surfaces (widget + revisit + digest).
  Scarcity is what keeps it feeling curated.

### Feedback loop (what makes it adaptive)

Every resurface card gets two quiet affordances: **"more like this" / "not this"**. Each tap
writes a `resurface_feedback` row (item facets: topic, age bucket, evidence type, source).
A periodic job nudges `resurface_config` weights toward facets with positive feedback —
and the deltas are logged, so the user can open settings and see *why* the mix shifted
(legibility rule from the north-star spec applies here too).

### Implementation sketch

- `resurface_log` (item_id, surfaced_at, surface, feedback) — powers gap penalty + feedback.
- Selection runs client-side or in a tiny edge function at first open of the day; cached in
  localStorage until midnight (stable-per-day like the current ResurfaceWidget seed).
- v1 without embeddings: pools 1–3 + evidence/age/diversity only. Focus similarity and taste
  filter switch on after north-star ④/⑥. FIFO Revisit retires when this ships.
- [Tech debt](docs/tech-debt.md) — known problems ranked by impact; Deno npm: resolution + unapplied migrations need verifying
