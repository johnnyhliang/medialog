-- Reschedule fetch-opportunities to use net.http_post with cron secret (same pattern as fetch-reels)
-- Old cron used extensions.http_post without auth header, which gets 403 if CRON_SECRET is set

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-opportunities-hourly') THEN
    PERFORM cron.unschedule('fetch-opportunities-hourly');
  END IF;
END $$;

select cron.schedule(
  'fetch-opportunities-daily',
  '0 8 * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/fetch-opportunities',
    headers := format('{"Content-Type": "application/json", "X-Cron-Secret": "%s"}',
      current_setting('app.cron_secret', true))::jsonb,
    body := '{}'::jsonb
  )
  $$
);
