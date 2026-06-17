-- Helper to get tags for a single entry in a flat text array.
create or replace function get_entry_tags(p_entry_id uuid)
returns text[]
language sql
security definer
set search_path = ''
as $$
  select array_agg(t.name)
  from public.tags t
  join public.entry_tags et on et.tag_id = t.id
  where et.entry_id = p_entry_id;
$$;
