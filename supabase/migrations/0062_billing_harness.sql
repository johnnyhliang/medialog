-- Payment infrastructure, deliberately INERT.
--
-- The schema and the tier-sync path exist so that turning billing on later is a
-- configuration change rather than a migration + refactor. Nothing here charges
-- anyone: there is no provider key, the webhook function refuses to run without
-- one, and app_flags.billing_enabled ships false.
--
-- Why build it now if it's off: the tier derivation and the founder-protection
-- rule are the parts that are painful to retrofit once real money and real
-- accounts exist. Getting them wrong later means either billing someone
-- incorrectly or silently revoking access. Getting them right is cheap today.

create table if not exists subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  provider               text not null default 'stripe',
  provider_customer_id   text,
  provider_subscription_id text,
  -- Provider's own vocabulary, stored verbatim. Mapping status -> tier is
  -- application logic (src/lib/billingPlan.js), not a DB concern, so a mapping
  -- change never needs a migration.
  status                 text,
  price_id               text,
  cancel_at_period_end   boolean not null default false,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);
create index if not exists subscriptions_provider_sub_idx
  on subscriptions (provider_subscription_id);

alter table subscriptions enable row level security;

-- Read-only to the owner, exactly like user_entitlements: writes come from the
-- webhook using the service role. A client-writable subscription row is a
-- client-writable tier, which is a free upgrade button.
create policy "subscriptions: read own" on subscriptions
  for select using (user_id = auth.uid());

-- ── Tier sync ───────────────────────────────────────────────────────────────
-- One authority for tier. The webhook writes a subscription row and calls this;
-- nothing else may set tier from billing data.
--
-- The founder rule is the important part: a founder account is granted manually
-- and must NEVER be downgraded by a billing event. Without this guard, a lapsed
-- test subscription would strip the operator's own access — and the operator is
-- the person least able to notice, since they're used to seeing everything.
create or replace function sync_tier_from_billing(p_user_id uuid, p_tier text)
returns void language plpgsql security definer as $$
begin
  if p_tier not in ('free', 'paid') then
    raise exception 'sync_tier_from_billing only sets free|paid, got %', p_tier;
  end if;

  insert into user_entitlements (user_id, tier, source, updated_at)
  values (p_user_id, p_tier, 'stripe', now())
  on conflict (user_id) do update
    set tier       = case when user_entitlements.tier = 'founder'
                          then 'founder'          -- manual grant wins, always
                          else excluded.tier end,
        source     = case when user_entitlements.tier = 'founder'
                          then user_entitlements.source
                          else excluded.source end,
        updated_at = now();
end;
$$;
revoke all on function sync_tier_from_billing(uuid, text) from public, anon, authenticated;

-- ── Test harness ────────────────────────────────────────────────────────────
-- Set a tier by hand so paid surfaces can be exercised without a payment
-- provider. Service-role only; scripts/set-tier.js is the intended caller.
-- This is what makes "build it but don't turn it on" workable — the paid UI is
-- testable today.
create or replace function set_tier_manual(p_user_id uuid, p_tier text)
returns void language plpgsql security definer as $$
begin
  if p_tier not in ('free', 'paid', 'founder') then
    raise exception 'invalid tier %', p_tier;
  end if;
  insert into user_entitlements (user_id, tier, source, updated_at)
  values (p_user_id, p_tier, 'manual', now())
  on conflict (user_id) do update
    set tier = excluded.tier, source = 'manual', updated_at = now();
end;
$$;
revoke all on function set_tier_manual(uuid, text) from public, anon, authenticated;

-- Off. Turning this on is the single switch that makes billing UI appear;
-- the webhook additionally requires its provider secrets to be set.
insert into app_flags (key, enabled)
values ('billing_enabled', false)
on conflict (key) do nothing;
