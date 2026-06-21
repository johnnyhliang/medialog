-- Reschedule cron jobs without X-Cron-Secret header.
-- For personal use, CRON_SECRET is optional — the edge function skips the check
-- if the env var is not set.

select cron.unschedule('fetch-opportunities-hourly');
select cron.unschedule('fetch-programs-daily');

select cron.schedule(
  'fetch-opportunities-hourly',
  '0 * * * *',
  $$ select net.http_post(
    url := 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/fetch-opportunities',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) $$
);

select cron.schedule(
  'fetch-programs-daily',
  '0 8 * * *',
  $$ select net.http_post(
    url := 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/fetch-programs',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) $$
);
