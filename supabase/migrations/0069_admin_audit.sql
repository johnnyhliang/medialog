-- Operator action log.
--
-- Emergency stop and per-account pause are both reversible booleans, which is
-- the right design — but reversibility without a record is a trap. Three weeks
-- after pausing an account you are left with a flag and no memory of what you
-- saw, so the safe move becomes "leave it paused", which is the wrong default
-- for a paying user. This table makes the decision reconstructable.
--
-- Every mutating action in admin-metrics writes one row. Reads are not logged:
-- looking at the dashboard is not an event, and logging it would bury the rows
-- that matter.
--
-- `before` / `after` hold the flag values either side of the change, so the log
-- alone is enough to undo an action without inferring what the old state was.

create table if not exists admin_actions (
  id             bigserial primary key,
  actor_id       uuid not null references auth.users(id) on delete set null,
  action         text not null,          -- set_tier | set_ai_enabled | set_suspended
  target_user_id uuid references auth.users(id) on delete set null,  -- null = global
  before         jsonb,
  after          jsonb,
  reason         text,
  created_at     timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on admin_actions (created_at desc);
create index if not exists admin_actions_target_idx on admin_actions (target_user_id, created_at desc);

-- RLS on with NO policies at all. This is deliberate and stronger than a
-- founder-only read policy: the table is unreachable from any client key, and
-- the only path to it is the service role inside admin-metrics, which already
-- does its own founder check. An audit log a client can read is an audit log a
-- client can probe for the existence of other accounts.
alter table admin_actions enable row level security;

-- Records the action and returns the row id. security definer so the edge
-- function writes through one auditable path rather than an open insert.
create or replace function log_admin_action(
  p_actor uuid,
  p_action text,
  p_target uuid,
  p_before jsonb,
  p_after jsonb,
  p_reason text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into admin_actions (actor_id, action, target_user_id, before, after, reason)
  values (p_actor, p_action, p_target, p_before, p_after, nullif(btrim(coalesce(p_reason, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function log_admin_action(uuid, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;
