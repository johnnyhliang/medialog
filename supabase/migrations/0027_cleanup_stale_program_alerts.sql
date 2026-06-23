-- Remove program-alert opportunities for programs whose window is currently closed.
-- These were inserted when windows were open and never cleaned up.
delete from opportunities
where source = 'program-alert'
  and url in (
    select url from programs where window_open = false
  );
