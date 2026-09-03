-- How long a thing takes, so a week can be checked for feasibility.
--
-- `due_at` (0072) answers "when is this due". It cannot answer "does this week
-- fit", which is the question that actually causes the damage: an unbounded
-- claim on unknown future time is what makes a deadline three weeks out feel
-- like a deadline tomorrow. Feasibility needs a size as well as a date.
--
-- Minutes rather than hours because the useful estimates are small and
-- fractional hours invite false precision — a prelab is 20 minutes, not 0.33.
--
-- Nullable on purpose. Requiring an estimate at capture time would put a
-- decision in front of the capture, which is exactly the friction the log is
-- meant to remove; `assessWeek` falls back to a default and reports how many
-- entries it guessed at, so the total can be read with the right suspicion.
alter table entries add column if not exists estimate_minutes integer
  check (estimate_minutes is null or estimate_minutes > 0);
