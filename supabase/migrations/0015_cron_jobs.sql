-- supabase/migrations/0015_cron_jobs.sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'fetch-opportunities-hourly',
  '0 * * * *',
  $$ select extensions.http_post('https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/fetch-opportunities', '{}', 'application/json') $$
);

select cron.schedule(
  'fetch-programs-daily',
  '0 8 * * *',
  $$ select extensions.http_post('https://bhxqgpgyxqnqvnqjvrrj.supabase.co/functions/v1/fetch-programs', '{}', 'application/json') $$
);
