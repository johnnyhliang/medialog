# Spec: Metering, Product Analytics & Internal Dashboard

**Status:** ✅ **BUILT AND DEPLOYED 2026-07-30** — corrected 2026-08-06.
`_shared/meter.ts`, `0065_ai_usage.sql`, `src/lib/limits.js`, `admin-metrics` and
`MetricsView.jsx` all ship. **Caps are still deliberately unset** —
`aiCallsPerWindow` is `null` on purpose until there is real `ai_usage` history to
set it from; see `docs/limits-runbook.md`. · **Written:** 2026-07-29

This document is self-contained. It assumes no memory of the conversation that produced it.
Read it top to bottom before writing code — the ordering constraint in §0 is the reason the
spec exists.

---

## 0. Why the order matters (do not reorder)

**Instrumentation cannot be backfilled.** Every day MediaLog runs in production without event
capture is user behavior that is permanently unrecoverable. The dashboard is the easy part and
comes last.

Build in exactly this order:

1. **Phase 1 — AI usage metering.** Blocks pricing decisions, tier enforcement, and the import
   queue's backpressure. Smallest phase, highest leverage.
2. **Phase 2 — Product events.** Gated on picking the activation metric (§3.1).
3. **Phase 3 — Internal dashboard.** Only worth building once 1 and 2 have collected real data.

Phases 1 and 2 are independent of each other and may be built in parallel by separate agents.
Phase 3 depends on both.

---

## 1. Current state (verified against the repo, 2026-07-29)

### How AI calls work today

All AI runs through Supabase edge functions on **one shared key owned by the operator**. There
is no per-user key path anywhere, and no `api_key` column in any migration.

| Function | Key read from env | Purpose |
|---|---|---|
| `supabase/functions/ai/index.ts` | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | OpenAI-compatible chat proxy (`POST {baseUrl}/chat/completions`) |
| `supabase/functions/embed-entry/index.ts` | `GEMINI_API_KEY` | Embeddings — `gemini-embedding-001`, `output_dimensionality: 1536` |
| `supabase/functions/fetch-reels/index.ts` | `GEMINI_API_KEY` | Caption summarization |

Both `ai` and `embed-entry` authenticate the caller via
`createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })`
then `sb.auth.getUser()`, returning 401 when absent. **So `user.id` is already in scope at the
point where metering must be written.** Neither function meters or rate limits.

Response shapes to preserve exactly (callers depend on them):
- `ai`: `{ content }` on success; `{ error, detail }` with 400/401/500/502
- `embed-entry`: `{ embeddings }` when the request used `texts` (array), `{ embedding }` when it
  used `text` (single). Do not collapse these.

### Client-side embedding trigger

`src/lib/chunkEntry.js` → `chunkEntryAsync`, called from 8 sites in `src/App.jsx` (entry save
~465 and ~508, edit ~631, bulk/import paths ~729–819). Fire-and-forget by design: *indexing
must never break a save.*

It is already hash-guarded — `chunkSource` computes an FNV-1a hash of each source field
(`hashText`) and compares against the stored `content_chunks.source_hash`, skipping the API call
entirely when text is unchanged. **Re-importing already-indexed content costs zero API calls.**
Sources are `full_text`, `note`, `takeaway` (see `sourcesFor`).

There is no precomputation anywhere. No seeded content ships with vectors.
`scripts/backfill-embeddings.js` and `scripts/rechunk.js` exist but are manual.

### Founder gating (reuse this, don't invent new gating)

- `src/lib/account.js` → `showFounderFeatures(user, featureFlags)`
- `src/lib/featureFlags.js` → `loadFeatureFlags(supabase)` reads the `app_flags` table
- `src/App.jsx:102` → `const showFounder = showFounderFeatures(user, featureFlags)`
- `src/components/NavSidebar.jsx:21` → nav items take `founderOnly: true`; filtered at line ~110
- Migrations `0050_founder_flag.sql`, `0051_public_founder_feature_flag.sql`

The `career` view at `src/App.jsx:1183` (`{view === 'career' && showFounder && ...}`) is the
pattern to copy for a founder-only route.

### Repo conventions to follow

- **Migrations:** `supabase/migrations/NNNN_name.sql`, sequential. Highest existing is
  `0056_quick_links.sql`, so start at `0057`. Every table: `user_id uuid not null references
  auth.users(id) on delete cascade default auth.uid()`, then
  `alter table X enable row level security;` and
  `create policy "X: own rows" on X for all using (user_id = auth.uid()) with check (user_id = auth.uid());`
  Use `create table if not exists` / `create index if not exists`.
- **DB helpers:** one module per table in `src/lib/db/`, functions `await supabase.auth.getUser()`
  for `user_id` and `throw new Error(error.message)` on failure. See `src/lib/db/quickLinks.js`
  for the canonical minimal example.
- **Tests:** vitest, colocated as `*.test.js` / `*.test.jsx`. Full suite is currently
  **101 files / 509 tests, all passing** — keep it that way. Run `npx vitest run`.
- **Styles:** single `src/styles.css`. Use existing CSS custom properties (`--surface`,
  `--border`, `--muted`, `--accent`, `--text`, `--bg`, `--radius`). Do not introduce new colors
  or a CSS framework.
- **Comments:** explain *why*, not *what*. Match surrounding density — the codebase uses short
  block comments above non-obvious logic and avoids narrating obvious lines.

---

## 2. Phase 1 — AI usage metering

### 2.1 Schema — `supabase/migrations/0057_ai_usage.sql`

```sql
create table if not exists ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  day           date not null default (now() at time zone 'utc')::date,
  function_name text not null,          -- 'ai' | 'embed-entry' | 'fetch-reels'
  model         text,
  calls         integer not null default 0,
  input_tokens  bigint  not null default 0,
  output_tokens bigint  not null default 0,
  est_cost_usd  numeric(12,6) not null default 0,
  updated_at    timestamptz not null default now(),
  unique (user_id, day, function_name, model)
);
create index if not exists ai_usage_day_idx on ai_usage (day);
```

RLS: users may **select** their own rows only. Writes come from the edge functions using the
**service role** (which bypasses RLS), so there must be no user-facing insert/update policy —
otherwise a client can forge usage and defeat the cap.

```sql
alter table ai_usage enable row level security;
create policy "ai_usage: read own" on ai_usage
  for select using (user_id = auth.uid());
```

Add an atomic upsert RPC so concurrent calls can't lose increments:

```sql
create or replace function record_ai_usage(
  p_user_id uuid, p_function text, p_model text,
  p_input_tokens bigint, p_output_tokens bigint, p_cost numeric
) returns void language sql security definer as $$
  insert into ai_usage (user_id, day, function_name, model, calls, input_tokens, output_tokens, est_cost_usd)
  values (p_user_id, (now() at time zone 'utc')::date, p_function, p_model, 1, p_input_tokens, p_output_tokens, p_cost)
  on conflict (user_id, day, function_name, model) do update
    set calls         = ai_usage.calls + 1,
        input_tokens  = ai_usage.input_tokens  + excluded.input_tokens,
        output_tokens = ai_usage.output_tokens + excluded.output_tokens,
        est_cost_usd  = ai_usage.est_cost_usd  + excluded.est_cost_usd,
        updated_at    = now();
$$;
revoke all on function record_ai_usage(uuid,text,text,bigint,bigint,numeric) from public, anon, authenticated;
```

**Verify before relying on it:** `unique (user_id, day, function_name, model)` treats
`model IS NULL` rows as distinct in Postgres. Either make `model` `not null default ''` or use a
unique index on `coalesce(model,'')`. Pick one and note it in the migration comment.

### 2.2 Shared helper — `supabase/functions/_shared/meter.ts`

`_shared/` currently holds `extractTitle.ts` and `isSafeUrl.ts` (each with a colocated
`.test.js`) — follow that shape.

```ts
export async function recordUsage(admin, { userId, fn, model, inputTokens, outputTokens }): Promise<void>
```

Requirements:
- Takes a service-role client (`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`), calls
  the `record_ai_usage` RPC.
- **Never throws.** Wrap in try/catch and swallow. Metering failure must not fail a user's AI
  request — same principle as `chunkEntryAsync` being fire-and-forget.
- Cost estimation lives here as a small rate table keyed by model, with a documented fallback
  rate for unknown models. Keep the table in one place so repricing is a one-line change.
- Export `estimateCost(model, inputTokens, outputTokens)` separately so it is unit-testable
  without a database.

**Token counts:** the OpenAI-compatible response in `ai/index.ts` returns `data.usage`
(`prompt_tokens` / `completion_tokens`) — read it there rather than estimating. Gemini's
`embedContent` response does **not** return token counts; approximate as
`ceil(text.length / 4)` and comment that it is an approximation.

### 2.3 Cap enforcement in `supabase/functions/ai/index.ts`

Insert after the existing `sb.auth.getUser()` 401 check and **before** the provider `fetch`:

1. Read the caller's current-month `calls` sum for `function_name = 'ai'`.
2. Determine the cap for that user's tier (Phase 1 has no billing — read tier from a
   `user_tier` table or default everyone to the free cap behind an env var
   `AI_FREE_MONTHLY_CALLS`, default e.g. `100`).
3. Over cap → return `429` with
   `{ error: 'monthly AI limit reached', limit, used, resets_on }`. Do not return 500.
4. Under cap → proceed, then `recordUsage(...)` after a successful provider response.

Founder accounts must be exempt — check the same flag source as `showFounderFeatures` so the
operator's own usage is never blocked.

Apply the same `recordUsage` call in `embed-entry` and `fetch-reels`, but **do not cap
`embed-entry`** in Phase 1: capping embeddings silently degrades search rather than surfacing a
clear error, which is a worse failure mode. Note this asymmetry in a code comment.

### 2.4 Client surface (minimal in Phase 1)

- `src/lib/db/aiUsage.js` — `getMyUsage(supabase, { month })` reading own rows via RLS.
- Handle 429 wherever AI is invoked (`src/lib/ai.js`) by surfacing the message, not a generic
  failure.
- A single usage line in `SettingsView.jsx` ("AI calls this month: 34 / 100"). No charts here —
  that's Phase 3.

### 2.5 Acceptance criteria

- [ ] Two concurrent AI calls produce `calls = 2` on one row (atomic upsert holds).
- [ ] A client cannot insert or update `ai_usage` directly (RLS blocks it).
- [ ] Metering failure does not fail the AI request — test by pointing the RPC at a bad name.
- [ ] Over-cap request returns 429 with a usable message; founder account is exempt.
- [ ] `embed-entry` records usage and is not capped.
- [ ] `estimateCost` unit-tested for a known model and an unknown-model fallback.
- [ ] Existing `{ content }` / `{ embeddings }` / `{ embedding }` response shapes unchanged.
- [ ] `npx vitest run` still fully green.

---

## 3. Phase 2 — Product events

### 3.1 Decide the activation metric first

Do not instrument before this is written down. The working hypothesis:

> **Activation = sorted the inbox at least once during week one.**

Rationale: capture is frictionless and therefore weak signal; *sorting* is the moment the app
stops being a bookmark pile and becomes a library. If the builder disagrees, change it — but
record the decision at the top of the events module, because it determines which events matter.

### 3.2 Schema — `supabase/migrations/0058_events.sql`

```sql
create table if not exists events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name       text not null,
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists events_user_created_idx on events (user_id, created_at desc);
create index if not exists events_name_created_idx on events (name, created_at desc);
```

RLS: insert own rows, select own rows. This is client-written, so treat it as untrusted — it
answers "what did users do", never "what should we bill". Billing lives in `ai_usage`, which
clients cannot write. **Keep that separation.**

### 3.3 The event list — keep it short

Resist logging everything. Ship exactly these:

| Event | Props | Why |
|---|---|---|
| `entry_created` | `{ source: 'paste' \| 'capture' \| 'import' \| 'bulk' }` | core action + which funnel |
| `inbox_sorted` | `{ count }` | the activation metric |
| `search_run` | `{ mode: 'semantic' \| 'keyword' }` | is the embedding investment used |
| `digest_opened` | `{}` | retention hook |
| `topic_created` | `{}` | library structure forming |

### 3.4 Implementation

`src/lib/track.js`:

```js
export function track(supabase, name, props = {})   // fire-and-forget, never throws
```

- Must never throw or block the UI — same contract as `chunkEntryAsync`.
- Batch/debounce: buffer in memory, flush on a short timer and on `visibilitychange`, so a burst
  import doesn't fire hundreds of inserts.
- No-op when `supabase` is falsy so tests and the landing page don't need mocks.
- **Do not put note text, entry titles, URLs, or search queries in `props`.** Counts and enums
  only. This is a personal knowledge base; leaking content into an analytics table is a
  betrayal of the product's premise, and `mode`/`count` answer every question that matters.

Call sites: the same `App.jsx` handlers that already call `chunkEntryAsync`, plus the inbox sort
flow and digest view mount.

### 3.5 Acceptance criteria

- [ ] `track()` with a throwing client does not reject or surface an error.
- [ ] Burst of 200 `entry_created` calls results in batched inserts, not 200 round trips.
- [ ] No event payload contains user content (assert on the props schema in a test).
- [ ] Activation metric is answerable with one SQL query — write and include that query.

---

## 4. Phase 3 — Internal dashboard

Founder-only route. Follow the `career` view pattern: add
`{ view: 'metrics', label: 'Metrics', icon: …, founderOnly: true }` to `NavSidebar.jsx` and
`{view === 'metrics' && showFounder && <MetricsView … />}` in `App.jsx`.

### 4.1 What it shows

Aggregate across all users, so it needs service-role reads via a small edge function
(`supabase/functions/metrics/index.ts`) that verifies the caller is a founder before returning
anything. **Do not** attempt cross-user aggregation from the client — RLS will silently return
only the operator's own rows and the numbers will look plausibly wrong, which is worse than an
error.

Panels:
1. **Growth** — signups/day, DAU/WAU, WAU/MAU ratio.
2. **Activation funnel** — signed up → created an entry → sorted the inbox → opened a digest,
   as week-one cohort percentages.
3. **Retention** — weekly cohort grid (week 0..8 retained %).
4. **Cost per active user** — `ai_usage.est_cost_usd` summed per user per month, with median and
   p95, not just the mean. The mean will be dragged by the operator's own account; exclude
   founder accounts from cost stats and say so in the UI.
5. **Storage** — bytes per user from `snapshots.bytes`. See the caution in §5.
6. **Margin** — revenue per tier minus (AI cost + storage cost) per user, once billing exists.

### 4.2 Charting

If any chart is drawn, **load the `dataviz` skill first** and follow it. Do not add a charting
CDN dependency — the app has no chart library today, and simple inline SVG sparklines plus the
existing CSS tokens cover everything above. A cohort grid is a `<table>` with background-color
cells, not a heatmap library.

### 4.3 Acceptance criteria

- [ ] Non-founder hitting the `metrics` function gets 403, and the nav item is absent.
- [ ] Every number traces to one documented SQL query, checked into the repo.
- [ ] Cost panel excludes founder accounts and shows median + p95.
- [ ] Renders correctly in both light and dark themes using existing tokens.

---

## 5. Cross-cutting decisions already made (do not relitigate)

**BYO API key is not the monetization model.** It inverts value capture — the user willing to
manage a Gemini key is the least likely to pay, and you've told them AI is free — walls off the
first-session magic moment behind setup, and leaves the operator holding the support burden
anyway. Offer it as a *free-tier escape valve* for power users who exceed the cap, never as a
paid SKU. Price on value instead: roughly $8–12/mo for uncapped-in-practice AI plus the
interview tracker, sharing, and storage. Inference is cents per user; "we charge $10, it costs
us $0.40" is the story that reads as a business.

**Embeddings are derived data and are never exported.** `src/lib/githubSync.js:28` already
excludes `content_chunks` with the right reasoning (megabytes of vector churn per commit,
rebuilt by `scripts/rechunk.js`). Extend that rule to every export path. Vectors are a cache
tied to a specific model and `chunkConfig.js`; exporting them creates silent search corruption
after any model change. **Do not add a user-facing toggle** — it asks users to reason about
something they cannot evaluate.

**The real import risk is burst, not spend.** Because of the `source_hash` guard, recompute cost
is near zero. The problem is hundreds of simultaneous `chunkEntryAsync` calls. Fix with a queue:
mark imported entries unindexed, drain a few per second. This is also the natural backpressure
hook for the Phase 1 cap, so build it alongside Phase 1 if time allows.

**Unit economics are probably not AI-dominated.** The file archiver's `snapshots` bucket
(25 MB/file limit, per `0054_snapshots.sql`) plus Supabase egress will likely outrun inference
cost. Track bytes stored per user next to API calls, or the dashboard will optimize the wrong
line item.

---

## 6. Suggested worktree workflow

```
git worktree add ../medialog-metrics -b feat/metering
```

Commit per phase, not per file. Migrations must be applied to a local/staging Supabase before
claiming a phase works — a migration that has only been written is not a migration that runs.
Run `npx vitest run` before each commit; the baseline is 509 passing tests.

Per repo convention: **no `Co-Authored-By` trailers in commit messages.**

Roadmap context for this work lives in `IDEAS.md` under
*"Launch readiness — metering, analytics, unit economics"*.
