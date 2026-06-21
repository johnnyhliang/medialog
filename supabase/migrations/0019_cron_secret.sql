-- Reschedule cron jobs to include X-Cron-Secret header.
-- The secret value must be set as a Supabase secret (CRON_SECRET) before deploying.
-- After setting the secret, also run in Supabase SQL editor:
--   alter database postgres set app.cron_secret = '<your-secret>';

select cron.unschedule('fetch-opportunities-hourly');
select cron.unschedule('fetch-programs-daily');

select cron.schedule(
  'fetch-opportunities-hourly',
  '0 * * * *',
  $$ select net.http_post(
    url := 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/fetch-opportunities',
    body := '{}'::jsonb,
    headers := format('{"X-Cron-Secret": "%s"}', current_setting('app.cron_secret', true))::jsonb
  ) $$
);

select cron.schedule(
  'fetch-programs-daily',
  '0 8 * * *',
  $$ select net.http_post(
    url := 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/fetch-programs',
    body := '{}'::jsonb,
    headers := format('{"X-Cron-Secret": "%s"}', current_setting('app.cron_secret', true))::jsonb
  ) $$
);
