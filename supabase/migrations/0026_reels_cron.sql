DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-reels') THEN
    PERFORM cron.unschedule('fetch-reels');
  END IF;
END $$;

select cron.schedule(
  'fetch-reels',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/fetch-reels',
    headers := format('{"Content-Type": "application/json", "X-Cron-Secret": "%s"}',
      current_setting('app.cron_secret', true))::jsonb,
    body := '{}'::jsonb
  )
  $$
);
