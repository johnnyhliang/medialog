-- Per-user capture tokens, replacing the shared CAPTURE_SECRET.
--
-- The old design had two structural problems:
--   1. VITE_CAPTURE_SECRET is inlined into the client bundle at build time, so
--      the secret ships to every visitor who loads SettingsView's chunk.
--   2. The capture function reads CAPTURE_USER_ID from env, so every capture is
--      attributed to one hardcoded account regardless of who called it.
--
-- Together those mean a second user could post captures into the founder's
-- library using a secret they were handed by the bundle. Fine for one user;
-- disqualifying for signups, and worse for a browser extension (extension
-- bundles unpack trivially).
--
-- Tokens are stored as SHA-256 hashes, never plaintext. A database leak then
-- yields no usable credentials, and the plaintext is shown exactly once at
-- creation — same contract as a GitHub PAT.

create table if not exists capture_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- sha256 hex of the token. Unique so a collision surfaces loudly rather than
  -- silently attributing captures to the wrong account.
  token_hash   text not null unique,
  label        text,                    -- 'iPhone shortcut', 'bookmarklet', …
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
create index if not exists capture_tokens_user_idx on capture_tokens (user_id);

alter table capture_tokens enable row level security;

-- Users manage their own tokens. Safe to allow inserts: the row holds only a
-- hash the client already knows, and user_id is pinned to auth.uid() so a token
-- can never be minted for someone else.
create policy "capture_tokens: own rows" on capture_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Resolves a token hash to its owner, bumping last_used_at so stale tokens are
-- identifiable. security definer because the capture function authenticates the
-- caller BY this lookup — there is no session to satisfy RLS with yet.
create or replace function resolve_capture_token(p_token_hash text)
returns uuid language plpgsql security definer as $$
declare v_user uuid;
begin
  select user_id into v_user
    from capture_tokens
   where token_hash = p_token_hash
     and revoked_at is null;
  if v_user is null then return null; end if;

  update capture_tokens set last_used_at = now() where token_hash = p_token_hash;
  return v_user;
end;
$$;
revoke all on function resolve_capture_token(text) from public, anon;
