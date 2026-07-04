# MediaLog — North Star Experience Design

**Date:** 2026-07-04
**Status:** Draft (for review)
**Supersedes nothing; unifies:** strategic roadmap v2, ai-agent-rag-design, feed work (0040),
and the habit-loop discussion of 2026-07-01. Existing specs describe *features*; this describes
the *system they must add up to*.

---

## The one-sentence thesis

MediaLog is an **external working memory with a manager attached**: it holds the thought so you
don't have to, tells you where you left off so you don't have to remember, and knows what you
care about so its machinery — feed, search, resurfacing, AI — gets sharper the more you use it.

Everything below derives from five user jobs, stated plainly:

1. **Park a side-thought in seconds and return to what I was doing.** (capture without derailment)
2. **Know where I am across many topics without re-reading everything.** (the manager)
3. **Save a URL with near-zero friction so my browser stops being a graveyard.** (capture surfaces)
4. **Find buried things later without remembering where I put them.** (retrieval)
5. **Have an AI that actually knows my interests and current position, and judges accordingly.**
   (the context engine)

A feature that serves none of these five is scope creep, however cool.

---

## Part 1 — Philosophy: the app has four moods, not seventeen views

The current nav (even grouped) is a list of *nouns*. The daily experience should be four *verbs* —
four distinct mental modes the user is in when they open the app. Every existing view belongs to
exactly one:

| Mood | User state | Surfaces | Interaction grammar |
|------|-----------|----------|---------------------|
| **Catch** | mid-task, distracted by a thought | QuickAdd, share target, bookmarklet, palette | ≤3 seconds, zero decisions, fire-and-forget |
| **Drift** | tired brain, wants low-effort value | Today page, Feed, Tidy queue, Resurface | one-tap decisions: save / dismiss / file |
| **Work** | focused on one topic | Topic view, Reader, Highlights, Note editor | deep, deliberate, full keyboard |
| **Review** | "where am I? what's rotting?" | Manager (new, Part 2), Digest, Progress, Revisit | scan → jump |

**Design rules this implies:**

- **Catch never asks questions.** No topic picker, no tags at capture time. Everything lands in
  Inbox; classification is Drift-mode work (this is already the "triage is mandatory" guardrail —
  extend it to *capture must be decision-free*).
- **Drift is finite.** Every Drift surface must be completable: the feed item count, the tidy
  queue, the resurface cards. Endless scroll is the failure mode we're replacing. "All clear"
  states are a feature, not an anticlimax.
- **Work is uninterruptible.** No badges, no feed counts, no nudges inside a topic view. The
  manager's job is *between* sessions, never during one.
- **Review is glanceable.** One screen answers "state of my world," 30 seconds, no clicking-in
  required to get the gist.

Long-term nav follows the moods (Catch is a global affordance, not a view; sidebar becomes
Today / Manager / Library / one topic list). Near-term, the grouped sidebar approximates this —
don't rebuild nav until the Manager exists.

---

## Part 2 — The Manager (the genuinely missing feature)

Job #2 has no owner today. Topics hold entries, but nothing holds *state*: where you left off,
what the next action is, whether it's warming up or going cold. The Living Topic Doc was designed
for synthesis; the Manager is smaller and more operational.

### Resume cards

Per active topic, a machine-maintained card:

```
┌─ Systems Design ────────────────────────────────┐
│ last touched 3d ago · 2 active · 5 backlog      │
│ ► You were reading "Designing Data-Intensive…"  │
│   (highlighted §4, ~40% through full_text)      │
│ next: finish ch. 5 notes        [resume] [park] │
└─────────────────────────────────────────────────┘
```

- **`topic_state` table:** `topic_id, last_entry_id, last_position, next_action (text),
  momentum (warm|cooling|cold), updated_at`. Most fields are *derived* (from `updated_at`s,
  reader scroll position, highlight timestamps); `next_action` is the one human-or-AI-written
  field.
- **`[park]`** is the underrated half: explicitly shelve a topic with a one-line note-to-future-self
  ("waiting on course to start"). Parked ≠ archived — it kills the ambient guilt of cold topics,
  which is what actually drives people back to doomscrolling.
- **Manager view** = resume cards sorted by (momentum, staleness), the Review mood's home screen.
  The Digest becomes the weekly narrative version of the same data.
- Reader already tracks enough to compute position; `next_action` drafting is a natural first
  string for the AI agent's safe-mutation tier.

This is the retention moat restated: capture tools are commodities; **an app that can answer
"where was I?" across twelve interests is not.**

---

## Part 3 — Capture surfaces (job #1 and #3)

Ranked by friction removed per unit effort:

1. **PWA share target** (manifest `share_target`) — iPhone/Android share sheet → Inbox. The
   single highest-value missing piece: it's where browser-tab clutter is born. Requires the PWA
   installed, which doubles as the home-screen placement from the habit discussion.
2. **Global quick-catch hotkey** — one keystroke anywhere in-app opens QuickAdd as an overlay
   (palette already exists; make catch a first-class verb in it). Text thought or URL, Enter,
   gone. The overlay closes to *exactly where you were* — Catch must not navigate.
3. **Bookmarklet** (specced in roadmap Phase 1) — desktop one-click; upgrade path to an
   extension later. The bookmarklet also grabs `document.title` + selection as note seed.
4. **Email-in address** (Phase D already) — lowest priority, but note it shares the same rule:
   everything lands in Inbox untagged.

**Anti-clutter contract:** if saving takes ≤3 seconds and retrieval works (Part 4), the browser
tab habit dies on its own. Don't build tab-sync/tab-import beyond the existing OneTab migration —
that treats the symptom.

---

## Part 4 — Retrieval: finding buried things (job #4)

Three complementary paths, two mostly built:

- **Search** (built): keyword + semantic. Gap: search is a *view*; it should also be the palette's
  default mode so retrieval never requires navigation.
- **Resurfacing** (started: Resurface widget, Revisit): the system volunteers buried things.
  Extend with "orphan surfacing" — entries with no tag, no topic-mates, never opened since save
  get priority in the tidy queue, because those are the ones that are *actually* buried.
- **Association** (not built, cheap once embeddings backfilled): "related entries" footer on every
  entry and topic — the moment you're in Work mode on topic X is exactly when a six-month-old
  save about X is findable *without being searched for*. This is roadmap Phase B "semantic links";
  its real value is that it makes *every past save* potentially resurface, which retroactively
  justifies every capture. That feedback loop is the retention engine.

---

## Part 5 — The context engine (job #5, and the idea that ties it together)

The ai-agent-rag spec designs a *reactive* agent: you ask, it retrieves, it answers. That's
necessary but it under-uses the corpus. The upgrade — and the thing no existing doc says — is:

**Maintain a machine-readable model of the user, and let every subsystem read it.**

### `user_model` (a document, not a vector database)

A single structured doc (markdown or JSON in a `user_model` table/row), auto-maintained by a
weekly cron + updated opportunistically after bursts of activity:

```yaml
interests:            # ranked, with evidence counts and trend
  - systems-design    (34 entries, ↑, currently reading DDIA)
  - ml-research       (28 entries, →)
  - korean            (12 entries, ↑ new)
  - valorant          (9 entries, →, leisure)
current_focus:        # from topic_state momentum
  - "systems design ch.5; YC application prep"
taste_signals:        # learned from feed behavior
  saves: [long-form technical, primary sources, indie blogs]
  dismisses: [listicles, announcement posts, crypto]
position:             # coarse self-description, user-editable
  "CS student, prepping YC app for MediaLog, learning Korean + Mandarin"
```

Derived from data that already exists: entries + topics + tags (interests), feed save/dismiss
rows (taste — **the feed is secretly a preference-labeling machine**; every dismiss is training
signal currently thrown away), topic_state (focus), highlights (what's actually read vs saved).

### Who reads it

| Consumer | Effect |
|----------|--------|
| **Feed ranking** | score = source quality × taste similarity × interest match. The feed stops being reverse-chron and starts being *yours*. Embedding centroid per interest vs. feed_item embedding = cheap personalized ranking, no fine-tuning. |
| **RAG chat** | `user_model` is Tier 0 context, above the three tiers in the agent spec. "Should I read this paper?" gets judged against *your* position, not generically. |
| **Triage suggestions** | inbox items get topic/tag suggestions conditioned on your taxonomy and phrasing, not generic classification. |
| **Resurfacing** | resurface cards weight toward current_focus topics — the archive quote you see today relates to what you're doing this week. |
| **Digest / Manager** | next_action drafts and weekly narrative written by someone who knows where you are. |

### Guardrails

- **Legible and editable.** The model is a doc you can open, read, and correct — never a hidden
  embedding soup. (Plain Text First applies to the model of *you* most of all.)
- **Evidence-linked.** Every interest cites entry counts; the model can't hallucinate a persona.
- **Decay built in.** Interests fade without new evidence; `position` has a staleness date so an
  old self-description doesn't steer a current judgment.
- Inherits the agent spec's safety model wholesale (proposals for anything destructive).

---

## Part 6 — Build order (credits-wise: each step ships standalone value)

Dependency-honest sequence; ①–③ are small, ④–⑥ are the platform, ⑦+ compounds on it.

| # | Build | Serves | Size | Notes |
|---|-------|--------|------|-------|
| ① | **Tidy queue** — one-card triage: untagged, orphaned, stale, expired | Drift, #4 | S | queries exist (HomeReviewSummary); it's a card UI |
| ② | **PWA share target + global catch hotkey** | #1, #3 | S | manifest change + QuickAdd overlay; put PWA on phone home screen |
| ③ | **Bookmarklet** | #3 | XS | capture edge function already exists |
| ④ | **Embedding backfill + related-entries footer** | #4 | M | pgvector infra exists; this is agent-spec step ① shipped as user-visible value |
| ⑤ | **Manager: `topic_state` + resume cards + park** | #2 | M | derived fields first; `next_action` manual until ⑦ |
| ⑥ | **`user_model` v1 + personalized feed ranking** | #5 | M | weekly cron writes the doc; feed scoring reads it; start logging dismiss signal *now* — it's free |
| ⑦ | **RAG chat (read-only)** with user_model as Tier 0 | #5 | M–L | agent spec step ②, now context-aware from day one |
| ⑧ | **Agent safe mutations** — triage suggestions, next_action drafts | #2, #5 | M | agent spec step ③ |

The strategic reframe vs. previous docs: **build the context engine (⑥) *before* the chat (⑦)**.
A chat that doesn't know you is a demo; a feed/manager/digest that knows you is a daily tool —
and it makes the eventual chat good on arrival.

## Non-goals (unchanged guardrails, restated against new features)

- No social/sharing until Phase D. No engagement mechanics (streaks, badges) — finite queues and
  resume cards are the honest versions of those.
- The user_model never leaves the user's Supabase row; it is not analytics.
- Four buckets stands: MediaLog is not a task manager — `next_action` is a *pointer into
  material*, not a todo system. If it grows due-dates, it's violating the bucket.
- Flat topics stands. The Manager sorts by momentum, not hierarchy.

---

## Open questions

- Reader position tracking: store scroll % per entry (cheap, slightly creepy) or highlight-based
  inference only?
- `user_model` update cadence: weekly cron vs. after-N-events trigger; cost per update is one
  cheap LLM call either way.
- Does `park` deserve a distinct topic lifecycle state in the DB, or is it `archived_at` + a
  `parked_note`? (Lean: new nullable `parked_at` + note; archive keeps meaning "done with this".)
- Palette-as-universal-catch vs. dedicated hotkey — test which one actually gets used.
