-- Rolling usage windows + an emergency kill switch.
--
-- 0065 bucketed usage by DAY, which answers "what did this cost last month" but
-- not "can I make another call right now". A monthly cap also fails badly: a user
-- burns the allowance on day 2 and is dead for 29 days, with nothing to show them
-- but a date far in the future.
--
-- Hourly buckets instead. A rolling N-hour window is then a sum over the last N
-- buckets — cheap (max 24 rows/day/function/model, versus one row per call) and
-- precise enough to drive a live meter. Daily and monthly rollups still work by
-- truncating the same column.

-- Safe to restructure: 0065 shipped hours ago and holds almost no data.
alter table ai_usage add column if not exists hour timestamptz;
update ai_usage set hour = day::timestamptz where hour is null;
alter table ai_usage alter column hour set not null;
alter table ai_usage alter column hour set default date_trunc('hour', now() at time zone 'utc');

alter table ai_usage drop constraint if exists ai_usage_user_id_day_function_name_model_key;
create unique index if not exists ai_usage_bucket_key
  on ai_usage (user_id, hour, function_name, model);
create index if not exists ai_usage_hour_idx on ai_usage (hour desc);

-- Rewritten to bucket hourly. Same name and signature, so callers are unchanged.
create or replace function record_ai_usage(
  p_user_id uuid,
  p_function text,
  p_model text,
  p_input_tokens bigint,
  p_output_tokens bigint,
  p_cost numeric
) returns void language sql security definer as $$
  insert into ai_usage (
    user_id, day, hour, function_name, model,
    calls, input_tokens, output_tokens, est_cost_usd
  )
  values (
    p_user_id,
    (now() at time zone 'utc')::date,
    date_trunc('hour', now() at time zone 'utc'),
    p_function, coalesce(p_model, ''),
    1, coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0), coalesce(p_cost, 0)
  )
  on conflict (user_id, hour, function_name, model) do update
    set calls         = ai_usage.calls + 1,
        input_tokens  = ai_usage.input_tokens  + excluded.input_tokens,
        output_tokens = ai_usage.output_tokens + excluded.output_tokens,
        est_cost_usd  = ai_usage.est_cost_usd  + excluded.est_cost_usd,
        updated_at    = now();
$$;
revoke all on function record_ai_usage(uuid, text, text, bigint, bigint, numeric)
  from public, anon, authenticated;

-- ── Rolling window ──────────────────────────────────────────────────────────
-- Returns usage in the trailing p_hours, plus when the OLDEST bucket in that
-- window ages out. That timestamp is the honest answer to "when does this reset":
-- in a rolling window nothing resets all at once, capacity returns gradually, and
-- the next return is when the oldest bucket falls off.
create or replace function my_ai_usage_window(p_hours int default 5)
returns table (calls bigint, est_cost_usd numeric, oldest_bucket timestamptz, resets_at timestamptz)
language sql stable security invoker as $$
  with w as (
    select u.calls, u.est_cost_usd, u.hour
      from ai_usage u
     where u.user_id = auth.uid()
       and u.hour > date_trunc('hour', (now() at time zone 'utc')) - make_interval(hours => p_hours)
  )
  select coalesce(sum(w.calls), 0)::bigint,
         coalesce(sum(w.est_cost_usd), 0),
         min(w.hour),
         min(w.hour) + make_interval(hours => p_hours)
    from w;
$$;

-- ── Emergency stop ──────────────────────────────────────────────────────────
-- A global switch the founder can flip from the dashboard when spend runs away —
-- a compromised key, a runaway client, an unexpected bill. Deliberately coarse:
-- in an emergency you want one lever that definitely works, not a nuanced policy.
--
-- app_flags is world-readable but only service-role writable, so a user cannot
-- turn AI back on for themselves.
insert into app_flags (key, enabled)
values ('ai_enabled', true)
on conflict (key) do nothing;

-- Per-account suspension, for when one user is the problem rather than everything.
alter table user_entitlements add column if not exists ai_suspended boolean not null default false;

comment on column user_entitlements.ai_suspended is
  'Founder-set emergency brake for a single account. Blocks AI calls without changing tier, so the account keeps its features and the suspension is obviously temporary.';
