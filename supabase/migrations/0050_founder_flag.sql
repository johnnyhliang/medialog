-- DB-backed founder flag. The client gate previously relied only on
-- VITE_FOUNDER_IDS, which is baked into the bundle at BUILD time — changing it
-- requires a full Vercel rebuild, an easy footgun. A DB flag takes effect
-- immediately and works across devices. (Client gating is cosmetic anyway; the
-- real multi-tenant enforcement is the RLS on the underlying tables.)

alter table user_configs add column if not exists is_founder boolean not null default false;

-- Seed the founder account.
insert into user_configs (user_id, is_founder)
values ('f50956f4-bb9c-45da-95e0-b351c7ee1dc3', true)
on conflict (user_id) do update set is_founder = true;

-- Prevent a user from elevating their own is_founder via the client (the "own
-- config" policy otherwise allows full self-update). Only a value that stays the
-- same — or is changed by the service role, which bypasses triggers' auth — is
-- permitted from a normal session.
create or replace function guard_is_founder() returns trigger
language plpgsql security definer as $$
begin
  if new.is_founder is distinct from old.is_founder
     and auth.role() <> 'service_role' then
    new.is_founder := old.is_founder; -- silently ignore the attempted change
  end if;
  return new;
end;
$$;

drop trigger if exists on_user_config_guard_founder on user_configs;
create trigger on_user_config_guard_founder
  before update on user_configs
  for each row execute function guard_is_founder();
