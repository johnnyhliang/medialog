# MediaLog — Vision & Product Philosophy

> Last updated: 2026-06-26. This is the living product philosophy document — the "why" behind every decision. The "what is built" lives in PROJECT.md. When these conflict, update both.

---

## The Problem Worth Solving

Every tool you've tried fails the same way: **capture is easy, retrieval is hard, synthesis never happens.** Chrome tabs die with the browser session. Notion databases become digital attics. Obsidian graphs look impressive and go unread. Instagram saves, YouTube watch-later, Reddit bookmarks — all graveyards. The information moved but never landed.

The failure mode is always storage masquerading as a system. Storage is passive. A system has metabolism — things move through it, get processed, get connected to what you build.

MediaLog is the metabolism layer. Not another bucket for things to rot in.

---

## The Five-Stage Loop (the actual product)

```
CAPTURE → TRIAGE → CONSUME → RETAIN → SYNTHESIZE
```

Every competitor owns one or two stages:

| Tool | Owns |
|------|------|
| Instapaper / Pocket | Consume |
| Readwise | Capture → Retain |
| Obsidian | Synthesize |
| Notion | Organize (but not the loop) |
| Chrome tabs | Nothing — it's not even a tool |

MediaLog's moat is **closing all five in one tool for the personal media diet use case.** The constraint is the product — it's not a blank canvas (Notion), it's an opinionated pipeline built around how information actually becomes useful.

---

## Core Principles (these govern every decision)

1. **A source is not a system.** Tabs, email, feeds, Canvas are inboxes — noise. MediaLog is the system — signal. You deliberately move things into it.

2. **Triage is mandatory.** Every capture lands in Inbox. The Sort Inbox gate is not optional — it's the anti-graveyard mechanism. Information without context is just stored noise.

3. **Retention is the product.** If you don't remember it, you didn't learn it. Resurfacing is baked into the data model, not bolted on.

4. **Flat over nested.** No subtopics. Nesting is what created the Obsidian mess. One entry = one topic; tags are the cross-cutting layer.

5. **One fixed shape per data type.** Malformed notes are structurally impossible, not just discouraged.

6. **Plain text underneath.** Data stays open, portable, grep-able, exportable. Never locked in.

7. **Speed is a feature.** Instant capture, instant navigation. If it's slow you won't use it. This overrides convenience of using complex infrastructure.

8. **Non-destructive by default.** Agents and bulk actions propose destructive changes for confirmation. Reversible actions (tag, status, pin, snooze) run directly.

---

## The Three-State Model (not saved/unsaved)

Most tools have two states: saved and deleted. This is the root failure. MediaLog uses three:

**Captured → Processed → Integrated**

- **Captured:** In the system, hasn't been consumed yet. The inbox.
- **Processed:** You actually read/watched/listened. You have notes or highlights.
- **Integrated:** You referenced this in something you built, wrote, or shipped. The highest-signal state.

The third state is what nobody tracks, and it's the most valuable signal you have. It tells you which sources actually influence your output — not just what captured your attention.

The UI and metrics should make this three-stage movement feel natural and rewarding, not like data entry.

---

## Metabolism Mechanics

These are the features that transform MediaLog from storage to throughput. Implement them in this order — each one closes a gap in the loop.

### Decay Scoring
Every saved item has a freshness score that degrades over time. A video saved three weeks ago and never touched starts visually dimming — a subtle background desaturation or card aging indicator. This creates ambient urgency without push notifications. The shelf getting dusty is the game mechanic. Same psychological hook as a streak, but per-item rather than global, so missing a day doesn't break anything.

### Source Quality Leaderboard
Track per source (YouTube channel, domain, newsletter, Twitter account) the ratio of saves → processed → integrated over rolling 30/90 days. Over three months you'll have a ranked list of which inputs are actually signal vs. noise for you specifically. This is something Obsidian and Notion can't do — they don't know your consumption behavior. It also gives you a concrete, data-backed reason to prune subscriptions rather than a vague feeling that a channel "isn't good anymore."

### Resonance Rating
Not stars at save time — stars at review time, 24–48 hours after you mark something processed. "How much did this shift your thinking?" on a 1–5 scale. This catches recency bias and forces the reflection question when the information has had time to actually land. High-resonance items surface in a dedicated "return to this" queue separate from the standard revisit feed.

### Rabbit Hole Detector
When five or more items on the same topic are saved within 72 hours, surface it as an "emerging interest cluster" and prompt: start a project, start a note, or dismiss. This converts passive saves into active building momentum. Given the pattern of going deep on things fast (ContextOS, mmgrep, AEO tooling), this would catch project ideas much earlier and give them somewhere to go before the energy dissipates.

### Build Connection Layer
Every item can be linked to a project. When you ship something, you can mark which saved items informed it — retroactively or in real time. Over time this builds a map of your actual intellectual supply chain: which articles fed ContextOS, which papers informed the Twitter pipeline. This is the Obsidian graph but grounded in what you actually built, not what you thought was related. The connection is directional and meaningful: "this informed that."

### Processing Queue as Primary View
The default view should not be "all saves" — it should be your processing queue, sorted by decay score, filtered by content type. The accumulation view is secondary. This reframes the app from a storage tool to a throughput tool. The number to minimize is unprocessed items, not total items saved.

---

## What to Take From Notion

Notion's polish is real. The things worth taking aren't surface features — they're underlying product decisions.

**Views are queries, not folders.** The same saved item appears in your "to-watch queue" view AND your "ContextOS research" project view simultaneously, without duplication. If the app uses folders or categories at the data layer instead of the view layer, you rebuild Notion's organizational debt. Tags are already moving in this direction — push it further.

**Document and database are the same primitive.** A saved item and a project note should be the same type of object. Both are rich documents. The difference is metadata (source URL, decay score, content type) and position in the relationship graph. This means when you're deep in processing an article, you can fluidly extend it into a full note, reference it from a project, or promote it to a project itself — no mode switching.

**Cmd+K global search.** Once you have enough saves, this becomes the primary navigation mode. Fast, fuzzy, scoped — search by content, by topic, by tag, by status. This replaces the sidebar as the primary way to find things for power users.

**Per-content-type auto-scaffold.** When you save a YouTube video, automatically show: timestamp highlights field, key claims, application notes. When you save an article: author, key quote, resonance. When you save a repo: what problem it solves, language, star count at save time. Notion forces you to configure this manually; MediaLog should infer from URL and pre-scaffold. The templates should feel like the right default appeared, not like you built a database schema.

**Relations over tags for project connections.** Tags are unidirectional and carry no semantic meaning about the relationship. "This article informed the mmgrep architecture" is not the same as "this article is tagged mmgrep." When you link a save to a project, the project should also show all linked saves — bidirectional, zero configuration.

**What NOT to copy:** The block editor for browsing (too slow, wrong UX for scanning). The confusing relations UI. The load time. The surface area — Notion has 15 concept types; MediaLog should expose complexity progressively, not upfront.

---

## The Metrics That Actually Matter

The right dashboard is not productivity theater. These are the numbers that tell you something real:

| Metric | What it tells you |
|--------|------------------|
| **Absorption rate** (processed / captured, 30-day rolling) | Whether you're saving things you actually consume |
| **Top sources by resonance** | Which inputs are worth your attention long-term |
| **State distribution** (captured / processed / integrated) | Where the bottleneck in your loop is |
| **Emerging interest clusters** | What your brain is pulling toward before you consciously name it |
| **Build connection map** | What actually informed the things you shipped |

The absorption rate is the scoreboard metric. Treat it like a poker session EV — check it weekly, not daily. A healthy absorption rate (roughly 60–80% of saves processed within 30 days) means the capture bar is calibrated correctly. If it drops, either you're saving too much noise or the processing UX has too much friction.

---

## Psychology of Use (how to make this actually get used by the person who built it)

The challenge with productivity tools is that they're designed for the kind of person who enjoys productivity tools. MediaLog's builder is not that person. The system has to be designed around the actual dopamine wiring in play.

**The competitive frame beats the productive frame.** A leaderboard with one metric (absorption rate, items integrated this week, source quality rank) works where a to-do list doesn't. The number becomes the game. Pick one metric per feature and make it a scoreboard. Treat it like EV in poker — you want to see the number go up, not because it's "good for you" but because winning is satisfying.

**Constraint injection over grinding.** When motivation dries up on a feature, introduce an artificial constraint: "ship this in 48 hours," "under 300 lines," "zero external deps." The constraint makes it a puzzle, and puzzles engage the part of the brain that built Magic Bot (40k users from a personal itch) and ContextOS (600+ downloads, still growing). Grind mode produces nothing; puzzle mode ships.

**Identity activation.** Projects with names, aesthetics, and a one-line pitch get sustained attention. Projects that are "a script" or "a helper" stall. MediaLog already has an identity — maintain and sharpen it. The aesthetic choices (Fraunces for display, warm palette, brutalist-adjacent card design) are not decoration. They're the signal to yourself that this is something worth caring about.

**Audience closes the dopamine loop.** ContextOS downloads, MediaLog stars, a DM from someone using it — these are real feedback signals that extend motivation past the initial build sprint. The next phase of MediaLog should have a public surface: a landing page, a public changelog, a shareable entry or reading log. Not for growth hacking. For the external reward signal that makes shipping feel complete rather than endless.

**The Magic Bot pattern as a filter.** Highest-output work has three things: genuine personal need + technical challenge + visible usage. When evaluating what to build next, run it through this filter. If one leg is missing, motivation decays. Most of the pure-maintenance work (cleanup, migrations, config) scores low on all three — do it fast, batch it, and return to building.

---

## What MediaLog Is Not

- Not a task manager (TickTick owns that slot)
- Not a calendar (Google Calendar owns that slot)
- Not a social tool (yet — audience layer is Phase D)
- Not a Notion replacement in general (it's an opinionated subset: personal media diet)
- Not a place to put everything (that's the graveyard pattern)

The scope constraint is the product. "Where does this belong?" should usually have a clear answer, and MediaLog should only be the answer for things in the Captured→Processed→Integrated loop.

---

## Career Section (approved design, 2026-06-26)

Career is a permanent sidebar item directly below Inbox — a second first-class citizen alongside it. Not a regular topic, not movable/archivable/pinnable. Always visible.

Inside Career, three tabs:

**Radar** (default tab)
Live opportunity listings from GitHub boards (internships, new grad, quant, underclassmen, fellowships, CS-everything-but-internships). Filter pills: All / SWE / Quant / PM / Fellowship / Saved / Unread. Mark read, save (★), track → sends to Applications tab. Manual add form for one-offs. Unread count badge on the tab.

**Watchlist**
UI over the `programs` table. Programs you manually add that aren't open yet — fellowships, research positions, competitive programs with annual cycles. Each row: name, URL, notes, expected open date (optional), status (open / closed / unknown from `fetch-programs` cron). Sorted by open date ascending (soonest first, unknowns at bottom). Full-text search across name + notes. When `fetch-programs` detects a program opens, it surfaces here with a highlight. Add form: name + URL + notes + optional expected open date.

**Applications**
The existing Applications tracker (saved → applied → screen → interview → offer / rejected / ghosted pipeline), moved in from top-level nav. No functional changes.

---

## Phases Ahead

These are ordered by leverage, not chronology. Each earns its own brainstorm → spec → plan → build cycle before any code is written.

**Immediate (this week):**
- Career section (specced above — ready to build)
- Finish Phase A brainstorm review (#5 highlights, #6 SRS)
- Wayback Machine fix (non-blocking but breaks UX)
- Remaining spec phases from 2026-06-23 plan (Phase 2–4: error feedback, autosave failure, QuickAdd visibility)

**Phase B — become the front door:**
RSS feed gathering (sources → Inbox for triage). Browser extension (one-click desktop capture). These close the capture gap between MediaLog and "just bookmark it in Chrome."

**Phase C — synthesis moat:**
Semantic search (embeddings — "find roughly related by meaning"). AI-auto-drafted topic docs. RAG chat over your library. Resonance rating + source quality leaderboard. Build connection layer. This is where MediaLog becomes genuinely irreplaceable rather than a better-designed version of existing tools.

**Phase D — reach:**
Public sharing / digital garden (the audience layer). YouTube transcript highlighting. Newsletter ingestion (`@medialog` email → entry). Native app. Note-taking sync (Notion/Obsidian/Roam — the real Readwise moat move).

---

## The One-Liner

MediaLog is the metabolism layer between consuming the internet and building things with what you learned. Capture is table stakes. Synthesis is the moat.
