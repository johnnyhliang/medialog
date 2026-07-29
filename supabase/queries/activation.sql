-- Activation metrics for MediaLog. Run against the production database.
--
-- PRIMARY activation: sorted the inbox at least once during week one.
--   Sorting is the moment the app stops being a bookmark pile and becomes a
--   library, and it is the behavior product work can move.
-- SECONDARY activation: captured on two separate days.
--   Sorting proves comprehension; returning proves habit, and the second is
--   usually the better retention predictor.
--
-- Both read `events` (see supabase/migrations/0058_events.sql). Week one is
-- measured from auth.users.created_at, not from first event, so users who never
-- do anything still count in the denominator.

-- ---------------------------------------------------------------------------
-- 1. PRIMARY — % of signups who sorted the inbox within 7 days of signup
-- ---------------------------------------------------------------------------
with cohort as (
  select id as user_id, created_at as signed_up_at
  from auth.users
  -- Exclude accounts too new to have had a full week to activate, otherwise the
  -- rate is dragged down by users still inside their window.
  where created_at < now() - interval '7 days'
),
activated as (
  select distinct c.user_id
  from cohort c
  join events e
    on e.user_id = c.user_id
   and e.name = 'inbox_sorted'
   and e.created_at < c.signed_up_at + interval '7 days'
)
select
  count(*)                                                     as signups,
  count(a.user_id)                                             as activated,
  round(100.0 * count(a.user_id) / nullif(count(*), 0), 1)      as activation_pct
from cohort c
left join activated a on a.user_id = c.user_id;

-- ---------------------------------------------------------------------------
-- 2. SECONDARY — % of signups who created entries on 2+ distinct days
--    within 7 days of signup (UTC days; date boundaries are good enough for a
--    habit signal and keep the query readable)
-- ---------------------------------------------------------------------------
with cohort as (
  select id as user_id, created_at as signed_up_at
  from auth.users
  where created_at < now() - interval '7 days'
),
capture_days as (
  select c.user_id, count(distinct (e.created_at at time zone 'utc')::date) as days
  from cohort c
  join events e
    on e.user_id = c.user_id
   and e.name = 'entry_created'
   and e.created_at < c.signed_up_at + interval '7 days'
  group by c.user_id
)
select
  count(*)                                                            as signups,
  count(d.user_id) filter (where d.days >= 2)                         as returned_second_day,
  round(100.0 * count(d.user_id) filter (where d.days >= 2)
        / nullif(count(*), 0), 1)                                     as retention_pct
from cohort c
left join capture_days d on d.user_id = c.user_id;
