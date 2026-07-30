# Metering — scoped build plan

**2026-07-30.** Design lives in `docs/metering-analytics-spec.md` §2. This is the
cut-down, sequenced version: what to build, in what order, and what to *not* build.

**Why this is the blocker:** `paid` currently grants nothing `free` doesn't, there
is no cost-per-user number, and every signup spends the shared API key through
`embed-entry` whether or not they open the assistant. That's arithmetic, not
preference.

---

## The correction that changes the design

The spec assumes chat is the cost centre. **It isn't** — measured 2026-07-30:

| Operation | Fires | Tokens |
|---|---|---|
| **`embed-entry`** | **every entry save** | the real spend |
| `askLibrarian` | per library question | ~1 550 |
| `askAppHelp` | per app question | ~1 010 |

So **meter both functions, but cap them differently.** Capping chat alone would
look responsible and change almost nothing.

---

## Phase 1 — Meter (no caps). Half a day.

Ship measurement before enforcement. You cannot pick a sane cap without knowing
what normal looks like, and a cap guessed today will be wrong.

**`0065_ai_usage.sql`**

```sql
create table if not exists ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  day           date not null default (now() at time zone 'utc')::date,
  function_name text not null,             -- 'ai' | 'embed-entry'
  model         text not null default '',  -- '' not null: NULL breaks the unique key
  calls         integer not null default 0,
  input_tokens  bigint  not null default 0,
  output_tokens bigint  not null default 0,
  est_cost_usd  numeric(12,6) not null default 0,
  updated_at    timestamptz not null default now(),
  unique (user_id, day, function_name, model)
);
create index if not exists ai_usage_day_idx on ai_usage (day);

alter table ai_usage enable row level security;
create policy "ai_usage: read own" on ai_usage
  for select using (user_id = auth.uid());
-- NO insert/update policy. Writes come from the service role only; a
-- client-writable usage table is a client-defeatable cap.
```

Plus `record_ai_usage(...)` as a `security definer` upsert that increments rather
than overwrites, so concurrent calls can't lose counts. Revoke from
`public, anon, authenticated`.

**`supabase/functions/_shared/meter.ts`**
- `recordUsage(admin, { userId, fn, model, inputTokens, outputTokens })`
- **Never throws.** Metering failure must not fail a user's request — same contract
  as `chunkEntryAsync`. Wrap and swallow.
- `estimateCost(model, inTok, outTok)` exported separately so it's unit-testable
  with no DB. Keep the rate table in one place; repricing is then one edit.
- Token counts: the OpenAI-compatible response carries `usage.prompt_tokens` /
  `completion_tokens` — read them, don't estimate. Gemini's `embedContent` returns
  none, so approximate `ceil(chars / 4)` **and comment that it is an estimate**.

**Wire into both `ai` and `embed-entry`,** after a successful provider response.

**Ship it and wait a week.** Then `select` your own usage and you have the number
pricing depends on.

**Acceptance:** two concurrent calls produce `calls = 2` on one row · a client
cannot insert/update `ai_usage` · a broken RPC name does not fail the AI request ·
`estimateCost` covers a known model and an unknown-model fallback.

---

## Phase 2 — Cap. Half a day, after real data exists.

**Cap `ai` (chat).** Before the provider fetch: sum the caller's current-month
`calls` for `function_name = 'ai'`; over the limit → **429** with
`{ error, limit, used, resets_on }`, never 500. Founder tier exempt.

**Do NOT cap `embed-entry` on the request path.** Capping embeddings silently
degrades search — the user gets no error, their notes just quietly stop being
findable. Instead:

- Meter it (Phase 1 already does)
- Control it with the **import queue** (task #5) — the same table as preservation
  jobs, per `preservation-v2-spec.md` §4. That converts a burst into a drain,
  which is what the free-tier TPM ceiling actually needs
- If a hard stop is ever required, fail *loudly*: mark entries unindexed and
  surface "N notes pending indexing", never fail silent

**Limits live in config, not code** — an `app_flags` row or an env var, so tuning
doesn't need a deploy.

**Acceptance:** over-cap returns 429 with a usable message · founder exempt ·
`embed-entry` records usage and is not capped · existing `{ content }` /
`{ embeddings }` / `{ embedding }` response shapes unchanged.

---

## Phase 3 — Surface it. Two hours.

- `src/lib/db/aiUsage.js` → `getMyUsage(supabase, { month })`, reading own rows
- One line in Settings → Behavior: *"AI calls this month: 34 / 100"*
- Handle 429 in `src/lib/ai.js` so the assistant shows the real message rather
  than a generic failure

No charts. That's the dashboard, and the dashboard is Phase 4 at the earliest.

---

## Explicitly NOT in scope

- **The admin dashboard.** Nothing to show until Phase 1 has collected. Building it
  first is how you end up with a beautiful page of zeroes.
- **Stripe / billing.** Independent of metering. Metering makes tiers *mean*
  something; billing makes them *sellable*. Do metering first.
- **Per-model routing or cost optimisation.** You are on a free tier. Optimising a
  $0 bill is not work.

---

## Definition of done

`assistant` can be promoted from `stage: experimental` to `minTier: 'paid'` in
`src/lib/modules.js` without handing strangers your API key. That single line
moving is the test of whether this worked.

**Total: roughly one day of work, split by a week of waiting for data.** The
waiting is the point — Phase 2's numbers should come from Phase 1's measurements,
not from a guess.
