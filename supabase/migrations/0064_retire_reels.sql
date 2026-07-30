-- Park the Instagram Reels pipeline. PARK, not delete.
--
-- It depends on a scraped `sessionid` cookie: fragile (the cookie expires on
-- Instagram's schedule, silently) and ToS-grey. It is also already inert —
-- INSTAGRAM_SESSION_ID has never been set as a Supabase secret, so every cron
-- run has been a no-op.
--
-- Deliberately kept: the `fetch-reels` edge function, the `Reels` topic and its
-- entries, and `ensure_reels_topic()`. Retiring an experiment is not a reason to
-- erase it — the code and its setup notes stay reachable to a founder account via
-- the `reels` module (minTier 'founder', see src/lib/modules.js), and the whole
-- thing can be revived by re-scheduling the cron below and setting the secret.
--
-- Only the cron is removed: a job firing every 15 minutes into a function that
-- cannot succeed fills cron.job_run_details with noise that hides real failures.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-reels') THEN
    PERFORM cron.unschedule('fetch-reels');
  END IF;
END $$;

-- To revive: set INSTAGRAM_SESSION_ID and CAPTURE_USER_ID as Supabase secrets,
-- redeploy the function, then re-run the schedule from 0026_reels_cron.sql.
