create table if not exists companies (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  ats        text not null check (ats in ('greenhouse','lever','ashby')),
  tags       text[] not null default '{}',
  enabled    boolean not null default true,
  created_at timestamptz default now()
);

alter table companies enable row level security;
create policy "companies: authenticated read" on companies
  for select using (auth.role() = 'authenticated');
create policy "companies: authenticated write" on companies
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- seed with the 21 companies currently hardcoded in careers.ts
insert into companies (slug, name, ats, tags) values
  ('anthropic',              'Anthropic',    'greenhouse', '{ai,research}'),
  ('openai',                 'OpenAI',       'greenhouse', '{ai,research}'),
  ('cohere',                 'Cohere',       'greenhouse', '{ai}'),
  ('mistral',                'Mistral',      'ashby',      '{ai}'),
  ('together-ai',            'Together AI',  'ashby',      '{ai}'),
  ('perplexity-ai',          'Perplexity',   'ashby',      '{ai}'),
  ('stripe',                 'Stripe',       'greenhouse', '{startup}'),
  ('linear',                 'Linear',       'ashby',      '{startup}'),
  ('vercel',                 'Vercel',       'ashby',      '{startup}'),
  ('anduril',                'Anduril',      'greenhouse', '{startup}'),
  ('figma',                  'Figma',        'greenhouse', '{startup}'),
  ('notion',                 'Notion',       'lever',      '{startup}'),
  ('google',                 'Google',       'greenhouse', '{big-tech}'),
  ('meta',                   'Meta',         'greenhouse', '{big-tech}'),
  ('apple',                  'Apple',        'greenhouse', '{big-tech}'),
  ('amazon-dev-center-u-s',  'Amazon',       'greenhouse', '{big-tech}'),
  ('microsoft',              'Microsoft',    'greenhouse', '{big-tech}'),
  ('two-sigma',              'Two Sigma',    'greenhouse', '{quant}'),
  ('citadel',                'Citadel',      'greenhouse', '{quant}'),
  ('hudson-river-trading',   'HRT',          'ashby',      '{quant}'),
  ('optiver',                'Optiver',      'greenhouse', '{quant}')
on conflict (slug) do nothing;

-- add radar_keywords to user_configs (safe if column already exists)
alter table user_configs add column if not exists radar_keywords text[] default '{}';
