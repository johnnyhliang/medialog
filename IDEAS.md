# MediaLog — Ideas & Open Threads

Living scratchpad of proposals, big swings, cuts, and handoff notes. Not a spec: nothing here
is committed work. Promote items into `docs/superpowers/specs/` when they get real.
(Companion docs: north-star spec for the philosophy/build order, `BRAND.md` for visual identity.)

★ = would genuinely prioritize.

**This file is the registry of every proposal** (as of 2026-08-06). If an idea exists
anywhere — a stray thought, or a fully written design doc — it gets a line here. That
rule exists because it was being broken: six features with complete specs had no entry
in this file at all, so the ideas you had developed furthest were the ones invisible
when browsing your own ideas. A proposal with a spec keeps its detail in the spec and
gets **one line** here pointing at it.

**Nothing here is scheduled.** A proposal becomes work only when it is ranked in
[`PROJECT-STATE.md` §6](PROJECT-STATE.md#6-ranked-next-actions-the-single-backlog),
which is the one list that answers "what next". That separation is deliberate: it
keeps this file free to hold half-formed and unlikely ideas without implying any of
them are planned.

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
  Reported again 2026-08-18 via assistant citations — see § *Citations reach the entry
  but not much else* below, which is the same gap felt from a different direction.

### Authoring parity — deliberately deferred (decided 2026-08-18)
Add-ons, not core. The product is capture → retrieval → resurfacing; competing with
Obsidian on authoring depth would lose and would distort what this is. Revisit if
users actually ask, not to close a feature-comparison gap.
- **LaTeX / math rendering** — genuinely absent. `MarkdownView.jsx:117` runs only
  `remark-gfm` + `rehype-slug`. Fix is small: `remark-math` + `rehype-katex` + KaTeX css
  into a pipeline that is already parameterised. ~1h whenever it's wanted.
- **Image paste is blocked by packaging, not capability.** `uploadAttachment`,
  a storage bucket with thumbnailing (`storage.js:48,65`), an `onPaste` handler and
  `accept="image/*"` all exist; the module-gated path answers "MediaLog doesn't host
  files" (`NoteEditor.jsx:198`). Unblocking is a decision, not a build.
- **Plain-text toggle for link-heavy entries** — `MarkdownView.jsx:11-27` swaps any
  paragraph that is *only* a link for a rich `LinkEmbed`, so twenty links become twenty
  cards with no way off. Per-entry toggle preferred over a global setting. Much less
  urgent once link previews are batched (see below).
- **Local-first** — not matchable and not worth chasing; the GitHub backup's markdown
  mirror already gives "your notes are plain files you own", which is most of the
  emotional benefit. Worth *saying* on the landing page; nothing to build.

### Citations reach the entry but not much else — ★ (reported 2026-08-18)
The assistant's citations *are* wired: `AssistantPanel` renders `[n]` chips and a source
list, both calling `onOpenEntry` → `handleSelectEntry` (`App.jsx:771`), which sets
`pendingEntryScroll`, switches topic, and scrolls to `#entry-<id>`. Three things stop
that being useful.

**1. Archived entries silently fail to open — a real bug, and the smallest fix.**
`TopicView.jsx:186` filters browsing with
`result.filter(e => isSearching || e.status !== 'done' || pendingArchiveIds.has(e.id))`.
Archived means `status === 'done'`, and arriving from a citation is not "searching", so
the target is never rendered, `document.getElementById` returns null, and the optional
chain swallows it. You land on the topic and nothing happens — no scroll, no error.
The filter is deliberate (its comment cites GitHub's `is:archived`), but a *direct jump*
is an explicit request for one entry and should override browse filtering. Fix: carry the
pending id into TopicView and always include it, exactly the exemption `pendingArchiveIds`
already gets.

**2. Nothing is hotlinkable.** Navigation is React state; no entry is ever written to the
URL, so there is no link to copy or share. Same gap as *Entry permalinks* above — needs
real routing, and is what would turn citations from clickable into shareable.

**3. No passage-level jump.** Retrieval is chunk-level and sources carry a `heading`, but
`handleSelectEntry` only knows the entry id, so it scrolls to the *card*, not the quoted
sentence. On a long note the citation is technically correct and practically useless.
Needs the citation to carry a chunk anchor and the renderer to highlight it — the largest
of the three.

### The in-app assistant cannot troubleshoot the app (reported 2026-08-18)
Better than it looks at first: `appHelp.js` already builds a knowledge block from the
module registry (every feature, description, stage, tier, and whether it is visible to
*this* user), the settings index (every setting → its tab), how Modules works, and the
full guide markdown — and `looksLikeAppQuestion` routes app questions there instead of to
the library.

The limit is that the knowledge is *generated from the registry*, so it knows "Data &
Backup exists and lives in Settings" and nothing about how anything can fail. When the
GitHub connect flow broke, it had nothing to say — no OAuth callback requirements, no
edge-function secrets, no failure modes. It is a "where is this setting" system, not a
troubleshooting one.

Worth deciding rather than drifting: either accept that and say so in the empty state, or
give it a hand-written troubleshooting section covering the flows that actually break
(GitHub connect, backup failures, indexing). The second is a docs problem, not a code one.

### Link previews are refetched per render — ★ the real performance debt
`LinkEmbed.jsx:40-43` calls `fetchLinkPreview` inside a `useEffect`, per component, per
mount. Twenty links in a note is twenty edge-function invocations every time the entry
opens, with no cache, no batching and no dedupe across entries. Entry-level previews are
already cached (`og_image`/`og_description` are columns, migration `0031`) — links
*inside* a note simply have no row to cache on.

Shape: a shared `link_previews` table keyed by a hash of the normalised url — not per
user, not per entry — holding title/description/image_url/site_name/favicon/status/
fetched_at. `MarkdownView` already parses the whole tree so it knows every url up front:
one batched lookup replaces N fetches. Misses enqueue rather than fetch inline, which is
the same shape as the `jobs` table already ranked in `PROJECT-STATE.md` §6 — build it
once, use it for both.

**Store the image url, never the bytes.** Hotlink with `loading="lazy"`; Discord stores
bytes because it is a CDN and link rot breaks its product, whereas here a dead thumbnail
is a shrug and stored bytes would scale cost with every link anyone saves. The exception
is the preservation module: if a user explicitly preserves an entry, pull the bytes then
— opt-in and bounded.

**Exclude `link_previews` from backup**, per the precedent already in `EXCLUDED_TABLES`
(`githubSync.js:76`): it is derived and regenerable, like `content_chunks` and
`feed_items`. The durable half already survives — the og_* columns ride on `entries`, and
the markdown mirror keeps the note with its links intact.

### Big entries are cramped — ★ a fundamental UX problem, unsolved
Reported 2026-08-18. Cards are tuned to be light and scannable, which is right for a
saved link and wrong for a journal entry, a document with many links, or a project doc.
Even with the column slider at 1 it reads cramped and awkward. This is not a spacing
tweak: the card is one component asked to serve two genuinely different content shapes.
Worth designing properly — a reading/writing mode, a distinct long-form entry type, or a
full-width detail view — rather than tuning padding.

---

## Big swings

- ★ **Views are queries, not tabs — named saved filters.** The single sharpest thing
  to come out of the 2026-08-07 scoping session, and it is already implied by two
  documents. `VISION.md` says *"views are queries, not folders"*; the Tuxedo analysis
  (`2026-06-19-tuxedo-analysis.md`) ranks **named saved searches** third by leverage
  and calls them *"the missing piece between 'search exists' and 'search is part of
  your workflow'"*. Neither was ever built.
  The realisation: **in org-mode the agenda is not a table, it is a saved query over
  your files.** Every time this app has needed a new way to look at entries, it grew a
  new tab and often a new table — which is how 24 modules and 20 nav items happened.
  A saved filter would retire several outright: *Highlights* is arguably just
  `has:highlight`, an agenda is `has:due sort:due`, a reading queue is
  `status:active tag:book`. Prerequisite for any further nav consolidation, and it
  reframes "should we build view X" as "is this a filter someone would save".
- **The nav is a list of nouns; the app has four verbs.** From the north-star spec,
  restated here because it is the test to apply to any new surface: Catch / Drift /
  Work / Review. Measured 2026-08-07: **24 modules, 20 nav items, 26 `view ===`
  branches, 16 settings tabs, 73 components.** Every feature works; the friction is
  deciding which one to open. Candidate merges beyond the Triage one already done:
  Digest+Progress (deferred until the Manager settles), Archive+Files+Trash ("things
  not in the active list"), Highlights → a saved filter per above. Roughly 20 → 12
  with no capability lost.
- **A plan and a log are different geometries — keep both, don't merge them.**
  From working through `quantdevplan.xlsx`, which is really five shapes wearing one
  filename: a *plan* (intent, month by month), a *body of work* (ordered, a curriculum
  or a project), a *log* (what actually happened), a *pipeline* (applications moving
  toward a binary outcome), and a *library* (resources). Most "project management app"
  confusion in that session came from smearing one word across all five.
  The useful framing that survived: **what is wanted is intent and evidence side by
  side** — the plan, and a record of what you actually did against it. That is why
  `manager-scope.md` splits into master-doc checkboxes (plan) plus a contribution grid
  (log), rather than one to-do list trying to be both. Pipelines stay in `career`,
  which already models stages properly.
- **A `kind` flag should be a label, not a route.** `topics.kind` (`'note'`, `'deep'`,
  `'goals'`) is one column, but `kind='deep'` sends you to a different screen, so a
  book and a project *feel* like different animals despite being the same rows in the
  same table. The data was always unified; only the routing wasn't.
  ⚠️ **Resolved narrowly 2026-08-07 and the resolution matters:** the fix is *not* one
  topic screen showing everything — that floods `TopicView` with machinery most topics
  never use. Keep the routing simple and put the specialised rendering on the Manager.
  See `manager-scope.md` §2 *The UI boundary*. Recorded here because the underlying
  observation is still true and will come up again.
- **`parent_id` on entries is the one place the flat-over-nested rule was broken.**
  Takeaways nest under takeaways (migration `0042`), against `PROJECT.md` principle 4
  (*"flat over nested — nesting is what created the Obsidian mess"*). There is
  currently no data using it, so flattening is free today and will not be later.

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

## Background activity log — ★ the structural fix for silent failure

**The single recurring failure mode in this codebase is background work that fails
into silence.** In one session (2026-08): auto-backup had done nothing for months;
4,971 chunks were written context-free past a warning that scrolled by; a complete
`renderReadme` was never called; Wayback recorded successes it never verified;
`index_status = 'pending'` was declared and never written; three settings tabs
claimed saves that never happened. Those are not six unrelated bugs — they are one
architectural gap. **Work that happens without a user watching has nowhere to
report, so it reports nowhere.**

**Scope it to things that happened *without* you.** A log of your own actions is
low value — you just did them, and Trash plus version history already cover
recovery. What you cannot observe is the automated half:

- auto-backup ran / failed, with the reason
- indexing: N notes queued, N failed, why
- feed polls: which sources returned nothing, which errored
- archival submissions and their verified outcome (see below)
- cron work: inbox archiving, revisit surfacing
- AI agent mutations, when those exist — the agent spec already requires an
  `agent_actions` log for undo (`docs/superpowers/specs/2026-06-25-ai-agent-rag-design.md`)

**`capture_log` is already this**, for one narrow case: `(ok, message, created_at)`,
surfaced as the last 8 in Settings. Generalising it is a small step, not a new
subsystem — same shape, more producers.

**Call it Activity, not Audit log.** *Audit* implies compliance and blame; *activity*
says "here is what happened while you weren't looking", which is what it is for a
single-user app and the reason someone would actually open it. Distinct from
`admin_actions`, which is the operator's log and is deliberately unreachable from
any client.

Design notes: append-only, retention-capped (a log that grows forever becomes a
storage bill and nobody reads row 40,000); quiet when healthy, following the
`IndexStatus` precedent; and **failures must be legible without opening it** —
the log is the detail, not the alarm.

## External archival — silent, logged, and never claiming success it hasn't verified

*Future consideration, deliberately.* An external archive is a copy **you do not
host**: zero storage cost, a citable URL, and it survives losing your account
entirely. Nothing you build yourself gives you that. The potential is real.

**What was wrong was never the idea.** `submitArchive` is a bare `window.open` at
`web.archive.org/save/<url>`, so it cannot know whether anything was archived — and
the caller writes `wayback_submitted_at` regardless, after which the bulk submitter
permanently skips that entry. **An unverified submission is worse than none**, because
it reports safety that does not exist, and only ever gets discovered at the moment
you needed the copy.

The agreed shape:

- **Submit in the background. Never claim success in the UI.** Until an outcome is
  verified there is nothing honest to display, so display nothing.
- **Write every attempt and outcome to the activity log above**, which is what makes
  it debuggable without being a feature surface.
- **Hide the current Wayback UI** rather than leaving it reporting fiction. The data
  it wrote stays; the claim goes.
- Real verification needs archive.org's **SPN2** API — POST with S3-style keys, get a
  job id, poll for status. That is CORS-blocked and credential-bearing, so it belongs
  in an **edge function**, never the client (the `VITE_CAPTURE_SECRET` lesson).
- **Worth checking: [Perma.cc](https://perma.cc)** is free through participating
  university libraries and is built for permanent citation, with a real API — a
  stronger guarantee than Wayback for things that matter. Verify eligibility before
  designing around it.

Pages first; **video is a separate problem** — see the transcript/metadata/liveness
work, since no external service archives YouTube for you.

## Specced but not built — each already has a full design doc

These were the *most* developed proposals here and, until 2026-08-06, the only ones
missing from this file: each earned a whole design document, and none of them had a
line in the idea list. Reviewing "what have I dreamed up" would have skipped exactly
the six you thought hardest about. Entries stay one line each — **the spec is the
detail, this is only the index.**

Four of them form one chain, meant to be built in order (**A→B→C→D**), because each
reuses the last one's widget:

- **Table / grid editor** *(chain B)* — edit GFM pipe tables in the note editor as an
  inline spreadsheet-style grid. → `docs/superpowers/specs/2026-07-17-table-grid-editor-design.md`
- **Live preview + slash commands** *(chain C, after B — reuses the table widget)* —
  an Obsidian-style live-preview editing experience, `/` to insert blocks.
  → `docs/superpowers/specs/2026-07-17-live-preview-slash-commands-design.md`
- **Collections + embedded views** *(chain D, largest — split D1/D2)* — replace
  Coda-style databases: query structured data and embed live views inside a note.
  → `docs/superpowers/specs/2026-07-17-collections-embedded-views-design.md`
- **Episodic extraction** — today's retrieval is *topical* (hybrid vector + lexical +
  trigram, RRF-fused); this adds the *episodic* axis, "what happened when". Depends on
  the chunk-retrieval engine (built, dormant).
  → `docs/superpowers/specs/2026-07-20-episodic-extraction-design.md`
- **Video archiver** — informational YouTube videos get deleted or made private before
  you rewatch them. **Superseded in approach** by `docs/preservation-v2-spec.md` §3:
  transcripts move to an edge function (captions are plain HTTP, no worker), media
  becomes opt-in on R2. Private-YouTube-reupload was considered and **rejected** —
  Content ID scans private uploads and a claim lands on the same Google account as
  your Gmail. → `docs/superpowers/specs/2026-06-28-video-archiver-design.md`
- **MCP v2** *(deferred)* — rebuild the MCP server against the current schema so you
  can query the library from Claude directly. The v1 server predates feeds, files,
  radar, topic lifecycle, Wayback and version history. **Do not connect v1 to
  anything first** — it has ungated bulk-write tools (`docs/tech-debt.md`).
  → `docs/superpowers/specs/2026-06-21-mcp-v2-design.md`

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

## The Today queue — ★ the one surface, unbuilt (scoped 2026-08-18)

The pieces all exist and none of them is pushed anywhere. This is the payoff the
`retired_at` work unblocked, and it is the thing NotebookLM and mymind both
structurally lack: **it brings things back to you.**

**What already exists, unwired:**
- `HomeReviewSummary.recommendedAction({inbox, oldInbox, staleBacklog, active})`
  is literally a next-action recommender, sitting on the Home view.
- `agenda.js` buckets into overdue / today / week / later.
- The SM-2 due queue (`listForRevisit`) is a "what should I see today" list by
  definition.
- **`send-email` is a deployed edge function referenced by nothing** in `src/`
  or `supabase/`.
- pg_cron and pg_net are installed, with nine `cron.schedule` calls already in
  the migrations, and a per-user timezone in settings.

So the work is connecting what is there, not new logic.

**Design:**
1. **One queue, not five surfaces.** Merge agenda-due-today + SRS-due +
   inbox-needing-triage into a single **Today** list. Those currently live in
   Home, Digest, Revisit, Manager and Agenda separately — the "thirteen
   surfaces, none trusted" problem. One list you can finish beats five you
   cannot.
2. **Cap it hard, five to ten items.** More important than the selection
   algorithm. An unbounded list is a guilt pile you learn to ignore; a finite
   one gets completed, and completion is what brings people back tomorrow. The
   SRS scheduler already produces a bounded set.
3. **Push it by email**, via `send-email` + pg_cron at the user's local time. A
   web app you must remember to open cannot be the answer to "so I don't have to
   manually check".
4. **Every item needs a terminal action**, including retire — otherwise the
   queue grows monotonically. `retired_at` shipped 2026-08-17 for exactly this.

Also a strong landing-page section, for the same reason.

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
