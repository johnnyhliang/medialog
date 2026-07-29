-- Decomposes gating into two storage locations with different trust levels.
-- See docs/intentional-app-spec.md Part 2, "Resolved 2026-07-29".
--
--   entitlement (tier)  → what the account is ALLOWED — server-owned, authoritative
--   preference (modules)→ what the user CHOSE to show — user-owned, cosmetic
--
-- These deliberately do NOT share a table. user_configs is user-writable via its
-- "own config" policy, so a `tier` column there would let any client PATCH
-- itself to paid. Entitlements therefore get select-only RLS and are written by
-- the service role (billing) exclusively.

create table if not exists user_entitlements (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  tier       text not null default 'free' check (tier in ('free', 'paid', 'founder')),
  source     text,                                   -- 'manual' | 'stripe' | 'grandfathered'
  expires_at timestamptz,                            -- null = no expiry
  updated_at timestamptz not null default now()
);

alter table user_entitlements enable row level security;

-- Read-only to the owner. There is intentionally no insert/update/delete policy:
-- writes come from the service role, which bypasses RLS. Adding a write policy
-- here would make every downstream tier check forgeable from the browser.
create policy "user_entitlements: read own" on user_entitlements
  for select using (user_id = auth.uid());

-- Absence of a row means 'free' (see resolveTier in src/lib/entitlements.js), so
-- no backfill is required for correctness. Existing accounts are seeded anyway
-- so the table is a complete picture rather than a sparse override.
--
-- Tier is derived from the existing user_configs.is_founder bit rather than a
-- hardcoded uuid, so this stays correct if the founder set ever changes.
-- 0050 already guards that column against client self-elevation via the
-- guard_is_founder trigger; user_entitlements generalizes the same idea without
-- needing a bespoke trigger per entitlement field.
insert into user_entitlements (user_id, tier, source)
select u.id,
       case when coalesce(c.is_founder, false) then 'founder' else 'free' end,
       'grandfathered'
  from auth.users u
  left join user_configs c on c.user_id = u.id
on conflict (user_id) do update
  set tier = excluded.tier, updated_at = now();

-- Revert the public demo exposure. Career/Interview/Assistant were briefly
-- shown to everyone via this flag so they could be demoed; they are internal
-- tools, so entitlement (minTier 'founder' in src/lib/modules.js) now governs
-- them and the blanket public switch is turned off.
update app_flags set enabled = false, updated_at = now()
 where key = 'founder_features_public';

-- ── Module preferences ──────────────────────────────────────────────────────
-- jsonb map of module id → boolean. Only explicit user choices are stored; any
-- module absent from the map falls back to its registry default.
alter table user_configs add column if not exists modules jsonb;

-- Grandfather existing accounts to everything-on. New accounts get the lean
-- default set from the registry instead. Silently hiding features someone uses
-- daily is the worst possible introduction to the modules system, so the
-- lean-default only ever applies at signup.
--
-- '{}' would mean "no explicit choices → use registry defaults", which for an
-- existing user is exactly the wrong answer. The sentinel below says "this
-- account predates modules; treat every module as on unless turned off."
update user_configs
   set modules = '{"__grandfathered": true}'::jsonb
 where modules is null;

-- Accounts that never created a user_configs row would otherwise be
-- indistinguishable from new signups and get the lean set. Give them a row.
insert into user_configs (user_id, modules)
select id, '{"__grandfathered": true}'::jsonb from auth.users
on conflict (user_id) do nothing;
