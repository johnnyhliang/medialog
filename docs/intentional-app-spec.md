# Intentional App — Reminders, Modularity, and Defeating Paradox-of-Choice

Status: ⚠️ **1 OF 3 BUILT** — corrected 2026-08-06. **Part 2 (modularity) ships** as
the three-layer module system (migration `0057`, `src/lib/modules.js`, Settings →
Modules). **Part 1 (Reminders + Agenda) and Part 3 (Today / Morning Open) are not
built** — Part 1 is the highest-value unbuilt feature in the project
(`PROJECT-STATE.md` §6 row 12) and Part 3 depends on it. Part 3 is also the more
current statement of the bounded/closeable philosophy than the north-star spec.

Original framing: three deeply related asks that share one thesis: MediaLog should feel
*calm and bounded*, not like another pile that grows forever. Each person turns on only what they
need; the app decides what to show today so you never doom-scroll your own library or fear gaps.

These three reinforce each other — reminders feed the Today screen; modularity hides what you don't
use; the Today screen + synthesis is the antidote to overwhelm. Build order at the bottom.

---

## Part 1 — Manual reminders (org-mode philosophy, not a todo dumping ground)

> ⚠️ **SUPERSEDED 2026-08-07 by [`manager-scope.md`](manager-scope.md).** The core
> instinct here — reminders are entries, not a new pile — was right, and the wider
> version of it is that *a topic is the project* and the plan lives in
> `topics.master_doc`. What this section got wrong was making due dates the primary
> surface: an Overdue bucket contradicts `gains-system.md` ("there are no dates and
> no 'behind'"), and a per-task deadline is how a plan becomes a nag list. The
> Agenda built against this section is parked and beta-gated; `entries.due_at`
> (`0072`) is retained for `target:` dates. **Read `manager-scope.md` instead.**

The trap: a reminders feature becomes a 200-item guilt list. Org-mode's antidotes, adapted to
MediaLog's existing model (entries, `status`, `surface_after`, topics, tags):

**Reminders are entries, not a new silo.** A reminder = an entry with a due date and a lightweight
TODO state. This is the whole design decision — it means reminders inherit capture, topics, tags,
search, synthesis, archival, and the Inbox→refile flow *for free*, instead of spawning a parallel
pile. MediaLog already has `surface_after` (snooze/schedule) and `status` (backlog/active/done).

**Borrowed org principles:**
- **Capture fast, refile later** — a reminder lands in Inbox; you file it into a topic when triaging.
  (Exact flow already exists.)
- **SCHEDULED vs DEADLINE** — two dates with different meaning: `surface_after` = "show me on/after
  this day" (scheduled), a new `due_at` = "this is actually due" (deadline, drives urgency + the
  Needs-attention banner).
- **NEXT-action filtering** — the antidote to bloat: an Agenda surfaces only what's *scheduled/due*
  plus the single next action per topic, never the whole backlog. You see a finite list, always.
- **States**: reuse `status` (backlog=TODO, active=NEXT/doing, done=DONE). Optionally a `waiting`
  state for blocked items. Don't over-model — 3–4 states max.
- **Weekly review ritual** — extend the existing Digest into the org-style weekly review (what got
  done, what's dormant, what's overdue). Closure, not accumulation.
- **Archive on done** — done reminders leave the agenda automatically (already how `status=done`
  behaves).

**Data model:** `entries.due_at timestamptz null` (+ optional `todo_state` if `status` proves too
coarse). No new table. A "reminder" is just an entry with `due_at` set.

**Surfaces:**
- **Quick capture** — a "remind me" affordance (text + optional date) that creates an Inbox entry
  with `due_at`. Reuses QuickAdd.
- **Agenda view** — a time-grouped list (Overdue / Today / This week / Later) of entries with
  `due_at`, plus per-topic next actions. This *replaces the todo app*.
- **Needs-attention banner** (see below) shows the most urgent handful.

**Anti-bloat guarantees (the "well-designed, not huge" requirement):** finite Agenda (next actions
only), snooze for "not now," auto-archive on done, weekly review for cleanup, and reminders live
inside topics so they're never a context-free heap.

---

## Part 2 — Modularity (turn features on/off in Settings)

MediaLog has grown many surfaces (Feed, Career, Interview, Deep topics, Reels, Market, Assistant,
Highlights, Progress, Digest, Tidy…). Not everyone wants all of them; showing all of them *is* part
of the paradox-of-choice problem. Make each a toggle.

**Architecture — a module registry + per-user prefs:**
- A static `MODULES` registry: `{ id, label, description, default, core }`. `core` modules
  (Home, Explore, Topics, Settings) can't be disabled.
- Per-user prefs in `user_configs.modules jsonb` (syncs across devices; generalizes the existing
  `is_founder` / `showFounderFeatures` gating — fold that into the same system).
- `NavSidebar` already filters items by a predicate (`founderOnly`); extend it to
  `enabled(module)`. Routes/views check the same.
- **Settings → Modules**: a checklist with descriptions; toggling updates `user_configs.modules`.

**Why this also helps new users:** ship a *minimal default set* (Home, Explore, Topics, Feed,
Reminders) and let people opt into the power features. The app stops overwhelming on first open.

**Decisions:** (1) default-on vs default-off per module — recommend a lean default-on core + the rest
default-off. (2) whether disabling a module hides its data or just its nav — recommend hides nav +
routes only, data untouched (reversible).

### Resolved 2026-07-29 — decompose gating into three layers

The line above ("fold `showFounderFeatures` into the same system") is **wrong as written** and
should not be implemented literally. `src/lib/account.js` currently reads:

```js
return isDev || Boolean(flags.founderFeaturesPublic) || isFounder(user)
//     ^dev convenience  ^global kill-switch          ^per-account identity
```

That `||` chain is three unrelated concerns wearing one name. Folding modules into it makes a
fourth. Decompose instead — visibility is the AND of three independent layers:

```
visible = entitled(tier, feature) && enabled(prefs, feature) && available(flags, feature)
```

| Layer | Answers | Written by | Storage | Trust |
|---|---|---|---|---|
| **Entitlement** | is this account *allowed* it? | server / billing | `user_entitlements` | authoritative |
| **Preference** | has the user *chosen* to show it? | the user | `user_configs.modules` | cosmetic |
| **Availability** | is it shipped / on globally? | ops | `app_flags` | kill-switch |

**These must not share a table.** `user_configs` is user-writable via the `"own config"` RLS
policy — put `tier` there and a user PATCHes themselves to paid. Entitlement gets its own table
with select-own and *no* insert/update policy (same shape and same reasoning as `ai_usage` in
`docs/metering-analytics-spec.md` §2.1). Preferences stay user-writable; forging them is harmless.

**Tier:** `tier text` in `{free, paid, founder}`. Founder is a tier *value*, not a special case,
and means "paid + internal tools" (metrics dashboard, uploads). Map each feature to a **minimum
tier** rather than a boolean per feature — one column beats a widening flag set. Keep `isDev` as a
separate dev-only override and `app_flags` as the ops kill-switch; three mechanisms, three names.

**The module list is identical for every tier.** Entitlement filters what's *offered*, so a free
user sees paid modules locked with an upgrade affordance rather than hidden — simpler than two
divergent lists, and better for conversion.

**Interview / Career / Assistant are founder-only, and are NOT paid features.** They were briefly
exposed to everyone via `founder_features_public` purely to demo them; migration 0057 flips that
flag off and gates them by entitlement instead (`minTier: 'founder'`). They are internal tools —
personal and experimental, not product surface. If they ever ship to users they become **free
opt-in modules**, never a paid upsell. `assistant` is the exception worth revisiting: it's the
natural first paid feature, so move it to `minTier: 'paid'` when billing ships — but not before
AI metering (task #4) exists, or signups reach the shared API key ungoverned.

**Note on storage:** `user_configs.is_founder` (migration 0050) already proved the
guarded-column pattern — a `guard_is_founder` trigger silently reverts client attempts to
self-elevate. `user_entitlements` generalizes that rather than contradicting it: one
service-role-only table beats adding a bespoke trigger for every future entitlement field
(`tier`, `expires_at`, `source`).

**Default-on set (new accounts only):** Home/Today, Inbox + capture, Topics/browse, Search,
Digest — the capture→sort→resurface spine, nothing else. Off by default: interview tracker,
career/opportunities, feed, reading/deep topics, files/archive, highlights, bulk import, and the
weather/market widgets. That last one retires the widget entries under *Cuts / quiet retirements*
in `IDEAS.md` without deleting anything — off-by-default, not gone.

**Grandfather existing accounts to everything-on.** A migration that silently hides features
someone uses daily is the worst possible introduction to the modules system. Defaults apply at
signup only.

---

## Part 3 — Paradox of choice: review without FOMO

The hardest, most philosophical piece: "help me synthesize/digest everything efficiently without
worrying about gaps or what I'm missing." The answer is **bounded, composed, closeable** surfaces —
never an infinite feed of guilt.

**① The Morning Open / "Today"** (already a ★ idea in IDEAS.md) — one composed screen that *decides
for you*: a **finite** set — e.g. top 3–5 relevant feed picks, due revisits, resurfaced snoozes, the
day's next actions, one resurfaced highlight. Explicitly bounded ("here are your 6 things"), with a
real **"you're caught up"** end state. FOMO needs an off-switch; this is it.

**② Synthesis over accumulation** (NotebookLM roadmap ①) — you consume the *synthesis* of a topic,
not every item in it. One-click Summary / Briefing / Timeline per topic, and a rolled-up daily
digest. "Efficiently digest everything" = auto-summaries, not more reading.

**③ Let the system hold coverage/gaps, not you** — the Interview tracker already models
coverage×confidence so you don't have to remember what you've covered. Generalize the pattern: the
app tracks what you've reviewed and surfaces gaps *only when relevant*, so "what am I missing" is the
app's job, not your anxiety.

**④ Closure states everywhere** — inbox-zero, "all tidy," "caught up for today" as genuine, reachable,
celebrated states (ties to the "one signature moment" aesthetic idea). Reachable bottoms defeat
infinite scroll.

This part is integrative — it mostly *composes* things that exist or are already planned (relevance
ranking ✓, revisit/SRS ✓, digest ✓, synthesis roadmap ①, reminders from Part 1) into one calm
surface. Little net-new data; mostly a new composed view + the "caught up" states.

---

## Build order

1. **Modules toggle system** (Part 2) — smallest, unblocks a calmer default and is pure infra
   (registry + `user_configs.modules` + NavSidebar predicate + Settings checklist). Fold in founder
   gating.
2. **Reminders** (Part 1) — `due_at` on entries + quick "remind me" capture + Agenda view.
3. **Needs-attention banner** — repurpose `DeadlineAlertBanner` to pull application deadlines + due
   revisits + resurfaced snoozes + overdue reminders (depends on #2).
4. **Today / Morning Open** (Part 3 ①) — the composed, bounded daily screen with a caught-up state.
5. **Per-topic synthesis** (NotebookLM roadmap ①) — feeds #4 and stands alone.

1–3 are concrete and near-term. 4–5 are the integrative payoff.
