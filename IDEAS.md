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
