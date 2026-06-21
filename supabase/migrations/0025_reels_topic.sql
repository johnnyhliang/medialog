-- Helper: ensure a 'Reels' topic exists for a user, return its id
create or replace function ensure_reels_topic(p_user_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  select id into v_id from topics where user_id = p_user_id and name = 'Reels' limit 1;
  if v_id is null then
    insert into topics (user_id, name) values (p_user_id, 'Reels') returning id into v_id;
  end if;
  return v_id;
end;
$$;
