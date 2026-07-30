-- The study plan as editable data rather than assumptions baked into code.
--
-- Pivoting (quant → SWE), adjusting a deadline, or narrowing focus should be one
-- field change that makes readiness, pace and next-problem suggestions all
-- re-derive. Nothing about problems or patterns needs migrating when priorities
-- change — that's the point of keeping the plan separate from the curriculum.
--
-- Lives on user_configs (user-writable, "own config" RLS) because this is a
-- preference, not an entitlement. Getting it wrong costs the user a bad
-- suggestion, not access to anything.

alter table user_configs
  -- Null = pace tracking off. A first-class state: the tracker works without a
  -- deadline and deliberately doesn't nag when there isn't one.
  add column if not exists prep_target_date date,
  -- Tracks currently being targeted, e.g. {'swe','sysdesign'}. Empty/null means
  -- "no focus" → every track weighted equally, which is the honest default
  -- before you've decided what you're interviewing for.
  add column if not exists prep_focus text[] default '{}';
