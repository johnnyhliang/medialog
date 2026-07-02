-- Server-side feed polling: source kind + quality threshold, scheduled fetch

alter table feeds add column if not exists kind text not null default 'rss'
  check (kind in ('rss', 'reddit'));
alter table feeds add column if not exists min_score int;

-- Poll all feeds every 2 hours via the fetch-feeds edge function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-feeds-2h') THEN
    PERFORM cron.unschedule('fetch-feeds-2h');
  END IF;
END $$;

select cron.schedule(
  'fetch-feeds-2h',
  '15 */2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/fetch-feeds',
    headers := format('{"Content-Type": "application/json", "X-Cron-Secret": "%s"}',
      current_setting('app.cron_secret', true))::jsonb,
    body := '{}'::jsonb
  )
  $$
);
