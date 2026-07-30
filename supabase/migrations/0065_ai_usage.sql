-- Per-user metering for the two things that actually cost money at scale:
-- AI calls and stored bytes.
--
-- Measured 2026-07-30: `embed-entry` is the real cost centre, because it fires on
-- every entry SAVE for every user whether or not they ever open the assistant.
-- Chat is secondary. Both are metered here; only chat is capped (see
-- docs/metering-scope.md) — capping embeddings on the request path degrades
-- search silently, which is a worse failure than a bill.
--
-- Phase 1 is MEASUREMENT ONLY. No caps are enforced by this migration. You cannot
-- pick a sane limit before knowing what normal looks like.

create table if not exists ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  day           date not null default (now() at time zone 'utc')::date,
  function_name text not null,                 -- 'ai' | 'embed-entry'
  -- NOT NULL with an empty-string default on purpose: Postgres treats NULLs as
  -- distinct in a unique constraint, so a nullable model column would silently
  -- create a new row per call instead of incrementing one.
  model         text not null default '',
  calls         integer not null default 0,
  input_tokens  bigint  not null default 0,
  output_tokens bigint  not null default 0,
  est_cost_usd  numeric(12,6) not null default 0,
  updated_at    timestamptz not null default now(),
  unique (user_id, day, function_name, model)
);
create index if not exists ai_usage_day_idx on ai_usage (day);
create index if not exists ai_usage_user_day_idx on ai_usage (user_id, day desc);

alter table ai_usage enable row level security;

-- Read-only to the owner. There is deliberately NO insert/update/delete policy:
-- writes come from the service role inside edge functions. A client-writable
-- usage table is a client-defeatable cap.
create policy "ai_usage: read own" on ai_usage
  for select using (user_id = auth.uid());

-- Atomic increment. Concurrent calls must not lose counts, so this upserts and
-- adds rather than reading-then-writing.
create or replace function record_ai_usage(
  p_user_id uuid,
  p_function text,
  p_model text,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_cost numeric
) returns void language sql security definer as $$
  insert into ai_usage (
    user_id, day, function_name, model,
    calls, input_tokens, output_tokens, est_cost_usd
  )
  values (
    p_user_id, (now() at time zone 'utc')::date, p_function, coalesce(p_model, ''),
    1, coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0), coalesce(p_cost, 0)
  )
  on conflict (user_id, day, function_name, model) do update
    set calls         = ai_usage.calls + 1,
        input_tokens  = ai_usage.input_tokens  + excluded.input_tokens,
        output_tokens = ai_usage.output_tokens + excluded.output_tokens,
        est_cost_usd  = ai_usage.est_cost_usd  + excluded.est_cost_usd,
        updated_at    = now();
$$;
revoke all on function record_ai_usage(uuid, text, text, bigint, bigint, numeric)
  from public, anon, authenticated;

-- ── Current-month rollup, used by the cap check and the Settings readout ─────
create or replace function my_ai_usage_this_month()
returns table (function_name text, calls bigint, input_tokens bigint, output_tokens bigint, est_cost_usd numeric)
language sql stable security invoker as $$
  select u.function_name,
         sum(u.calls)::bigint,
         sum(u.input_tokens)::bigint,
         sum(u.output_tokens)::bigint,
         sum(u.est_cost_usd)
    from ai_usage u
   where u.user_id = auth.uid()
     and u.day >= date_trunc('month', (now() at time zone 'utc'))::date
   group by u.function_name;
$$;

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Derived from `snapshots` rather than tracked separately: the bytes are already
-- recorded there at write time, so a second counter could only drift. Storage is
-- the other metered dimension because it is the one that grows without bound.
create or replace function my_storage_bytes()
returns bigint language sql stable security invoker as $$
  select coalesce(sum(s.bytes), 0)::bigint
    from snapshots s
   where s.user_id = auth.uid();
$$;
