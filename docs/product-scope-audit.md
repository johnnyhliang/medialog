# Product Scope Audit — what ships, what waits, what dies

**2026-07-30.** Every user-facing surface, judged against one question: *does this
belong in the product a stranger signs up for?*

Excluded by request: feed / learning / recommendation, scoped separately.

The mechanism enforcing all of this is `stage` in `src/lib/modules.js` — anything
`beta` or `experimental` is founder-only regardless of `minTier`, so this audit is
executable rather than aspirational.

---

## The thesis test

MediaLog's loop is **capture → sort → resurface**. A surface earns inclusion if it
serves that loop. Most things that feel like scope creep are answering a different
question, and the honest move is to park them rather than half-ship them.

---

## SHIP — the product (stable, free)

| Module | Why it's core |
|---|---|
| `home`, `capture`, `topics`, `search`, `settings` | The loop. Non-negotiable, `core: true` |
| `digest` | The payoff — the reason sorting was worth it. Default-on |
| `career` | **Free.** Scrapes public GitHub boards on a shared cron, so it costs nothing per user. Genuinely useful to the target audience |
| `highlights`, `archive`, `revisit` | Cheap, well-understood, small surface |
| `import`, `widgets` | Import is the funnel; widgets are opt-in decoration |

**Verdict:** this is a complete product, and as of 2026-07-30 it is metered. What
remains before charging is picking AI caps from real data and wiring Stripe —
neither of which blocks someone signing up and using it.

---

## WAIT — real, but not ready (beta/experimental, founder-only)

| Module | Stage | What's actually missing |
|---|---|---|
| `files` (archival) | experimental | Image/PDF copies work. **Article text unverified** (Deno `npm:` never confirmed). **Wayback records unconfirmed successes.** Captured entries never enriched at all. Roughly 1 of 4 tiers works |
| `assistant` | experimental | Now **metered** but not yet **capped**. `minTier: 'paid'` records the intent; promote once `aiCallsPerMonth` is set from real `ai_usage` history |
| `reading` | beta | Deep topics work; no UI for the pace/gap algorithms that were built |
| `progress` | beta | Stats exist; overlaps with digest and the unbuilt interview UI |
| `tidy` | beta | Works, but a batch-mutation tool with no undo story |
| `metrics` | experimental | **Built 2026-07-30.** Accounts, tiers, usage, cost, storage + inline tier control. Stays founder-only permanently — operator tooling |

**The pattern:** none of these are bad ideas. Each has a specific, nameable gap.
That's what `stage` is for — they stay reachable and keep improving without a
stranger hitting the rough edge.

---

## DON'T SHIP — founder-only permanently

| Module | Why |
|---|---|
| `interview` | Personal curriculum, not product. Your LeetCode tracker is not a feature strangers want |
| `reels` | Parked. Scraped session cookie, ToS-grey, and **already inert** — `INSTAGRAM_SESSION_ID` was never set |
| `twitter` | Auth token plumbing for the radar. Infrastructure, not a surface |
| `uploads`, `metrics` | Operator tooling |

---

## ~~The gap that blocks everything: AI metering~~ — BUILT 2026-07-30

**Status: metering built and deployed; caps deliberately deferred.**

`ai_usage` (`0065`) records per-user AI calls and estimated cost; storage is metered
from `snapshots.bytes`; `src/lib/limits.js` holds per-tier allowances for storage,
feeds and backup frequency, enforced in `createFeed` and the `snapshot` function.
A founder-only `MetricsView` shows every account, its tier, usage, cost and
subscription status, with an inline tier dropdown.

**AI call caps are intentionally unset** (`aiCallsPerMonth: null`) until `ai_usage`
has real history — see `docs/metering-scope.md` Step 5. Everything below described
the pre-metering state and is kept for the reasoning:

`supabase/functions/ai/index.ts` authenticates the caller and then does not meter
or rate-limit. `embed-entry` likewise. Consequences, all of them blocking:

1. **One user can drain the shared quota for everyone.**
2. **No cost-per-user number**, so pricing is guesswork.
3. **`paid` currently grants nothing `free` doesn't** — the tier exists, means
   nothing. `assistant` is the intended first paid feature and can't ship without
   a cap.
4. Semantic search itself calls `embed-entry` on every save, so *every* signup
   spends your key whether or not they touch the assistant.

**That was the single thing standing between "complete product" and "can accept
signups." It is now measured but not yet enforced** — you can see what a user
costs, and tiers grant real differences in storage/feeds/backup, but AI itself is
still uncapped. Remaining before charging: pick caps from real data, then Stripe.

## Admin / analytics — 3 of 3 phases

| Phase | State |
|---|---|
| Events (`0058`, `track.js`) | ✅ live, collecting |
| AI + storage metering (`0065`) | ✅ built + deployed |
| Admin dashboard (`metrics`) | ✅ built — founder-only, table not charts |

Events was built first deliberately: it cannot be backfilled, while metering can
be added the week you launch.

---

## How the mechanism works (and how to edit it)

Everything above is one field in `src/lib/modules.js`:

```js
{ id: 'files', label: 'Files & archival', description: '…',
  core: false, defaultOn: false,
  minTier: 'free',            // where it is HEADED
  stage: STAGE_EXPERIMENTAL } // who can reach it TODAY
```

**Promote a feature:** delete the `stage` line. It's now stable and takes its
`minTier`.
**Demote one:** add `stage: STAGE_EXPERIMENTAL`. Founder-only immediately, no
other edit needed.
**Make something paid:** set `minTier: 'paid'`. Only meaningful once billing and
metering exist.

Visibility is `entitled(tier) && enabled(prefs) && available(flags)`:

- **entitled** — `user_entitlements.tier`, server-only writes, unforgeable
- **enabled** — `user_configs.modules`, the user's own choice, harmless if forged
- **available** — `app_flags`, ops kill-switch (`founder_features_public` opens
  all founder modules at once, for live demos)

Consumed by `NavSidebar` items, Settings tabs, route guards in `App.jsx`, the
`useModuleAccess` hook for leaf components, and now the assistant's app-knowledge
map — so adding a row is the only step.

**Client gating is cosmetic.** RLS is the real enforcement. A forged tier reveals
nav items that lead nowhere. Never move a security boundary into this layer.

---

## What I'd actually do, in order

1. ~~**AI metering.**~~ Done. Next: after a week of `ai_usage`, set
   `aiCallsPerMonth` in `src/lib/limits.js` and add the cap to `ai/index.ts`.
2. **Verify the Readability extractor** — one capture, one script run. Either
   promote archival's article tier or fix it.
3. **Fix or retire Wayback.** It currently records successes it never confirmed,
   which is worse than not having it.
4. **Reminders + Agenda** (`docs/intentional-app-spec.md` Part 1) — the strongest
   unbuilt idea, and it ships behind a toggle from day one.
5. **Promote `tidy` and `progress`** — closest to stable, cheapest wins.
6. Leave `interview`, `reels`, `twitter` founder-only forever.

**Do not** promote `assistant` before AI caps exist — metering alone tells you the
damage after the fact; a cap prevents it.

## What is metered, and what could be

**Metered today:** AI calls (per function and model, with real token counts for
chat) · storage bytes · feed count · backup interval.

**Deliberately not metered:** entry/note count — capping capture poisons the core
loop, and rows are cheap. Search queries — they cost a keyword scan, not an
embedding. Topics, tags, highlights — all free to store and unbounded by nature.

**Candidates if a paid tier needs more substance**, roughly by how defensible each
is as a paid line rather than an artificial wall:
1. **Archival depth** — free keeps article text, paid adds full-page snapshots and
   video. Follows real cost and matches `preservation-v2-spec.md`
2. **Backup destinations** — free is GitHub, paid adds S3/R2. Real marginal cost
3. **Retention window on `feed_items`** — currently expires on a fixed schedule;
   paid could keep longer
4. **Assistant conversation history depth** — storage plus retrieval cost

Each of those is metered-by-nature: it costs you more when someone uses more. Avoid
gating things whose cost does not scale with use — that is a wall, not a plan.
