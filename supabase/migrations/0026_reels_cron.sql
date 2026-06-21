select cron.unschedule('fetch-reels') where exists (
  select 1 from cron.job where jobname = 'fetch-reels'
);

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
