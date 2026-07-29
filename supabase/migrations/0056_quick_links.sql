-- User-editable shelf of misc tools / resources for the home widget panel.
-- `note` is the load-bearing column: these are things you reach for by what
-- they DO ("strip a password off a PDF") long after you've forgotten what
-- they're called, so the widget searches note alongside label.

create table if not exists quick_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  label      text not null,
  url        text not null,
  note       text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists quick_links_user_pos_idx on quick_links (user_id, position);

alter table quick_links enable row level security;
create policy "quick_links: own rows" on quick_links
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Seed existing accounts with the links that used to be hardcoded in
-- QuickLinksWidget.jsx, plus the PDF tool that prompted making this editable.
insert into quick_links (user_id, label, url, note, position)
select u.id, v.label, v.url, v.note, v.position
from auth.users u
cross join (values
  ('gmail',        'https://mail.google.com',        'email',                                    0),
  ('calendar',     'https://calendar.google.com',    'schedule',                                 1),
  ('morning brew', 'https://www.morningbrew.com',    'daily business newsletter',                2),
  ('i hate pdf',   'https://www.ihatepdf.cv/',       'merge, split, compress, unlock PDFs — no signup', 3)
) as v(label, url, note, position)
where not exists (
  select 1 from quick_links q where q.user_id = u.id and q.url = v.url
);
